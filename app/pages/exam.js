window.ExamPage = (() => {
  const { el, escapeHtml, optionLetter, percent, typeLabel, imageListHtml } = window.AppUI;
  let timerId = null;

  function renderHome(ctx) {
    stopTimer();
    ctx.setShell("模拟考试", "自动组卷 · 90分钟", { hideMode: true, showBack: false });
    const root = el("section", "screen exam-home-screen");

    if (ctx.state.activeExam && !ctx.state.activeExam.submitted) {
      const active = el("button", "exam-active-card", "");
      active.type = "button";
      active.innerHTML = `
        <span>正在进行</span>
        <strong>${escapeHtml(ctx.state.activeExam.subject)}模拟考试</strong>
        <em>${escapeHtml(ctx.state.activeExam.examId)}</em>
      `;
      active.addEventListener("click", () => ctx.continueExam());
      root.append(active);
    }

    const grid = el("div", "exam-subject-list");
    window.QuestionRepository.getSubjects(ctx.repository).forEach((subject) => {
      const preview = window.ExamEngine.preview(ctx.repository, subject.name);
      const card = el("article", "exam-subject-card");
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <div class="exam-subject-card__head">
          <div>
            <strong>${escapeHtml(subject.name)}</strong>
            <span>${escapeHtml(preview.rule.name)}</span>
          </div>
          <b>${preview.totalScore}</b>
        </div>
        <div class="exam-structure">
          ${preview.rule.sections.map((section) => `<span>${escapeHtml(typeLabel(section.type))} ${section.count}题/${section.count * section.score}分</span>`).join("")}
        </div>
        ${preview.pendingScore ? `<p class="exam-warning">其中 ${preview.pendingScore} 分题目原资料未提供标准答案，提交后标为待核对。</p>` : ""}
      `;
      const button = window.AppUI.makeButton("primary-btn", "开始考试", () => ctx.startExam(subject.name));
      card.append(button);
      grid.append(card);
    });
    root.append(grid);

    if (ctx.state.examHistory.length) {
      const title = el("h2", "section-title", "最近成绩");
      const history = el("div", "exam-history-list");
      ctx.state.examHistory.slice(0, 5).forEach((item) => {
        const row = el("button", "exam-history-row", "");
        row.type = "button";
        row.innerHTML = `
          <span><strong>${escapeHtml(item.subject)}</strong><em>${escapeHtml(item.examId)}</em></span>
          <b>${item.score}/${item.totalScore}</b>
        `;
        row.addEventListener("click", () => ctx.openExamResult(item.examId));
        history.append(row);
      });
      root.append(title, history);
    }

    window.AppUI.setView(ctx.view, root);
  }

  function renderTaking(ctx) {
    const exam = ctx.state.activeExam;
    if (!exam) {
      ctx.openExamHome();
      return;
    }
    if (Date.now() >= exam.deadlineAt) {
      ctx.submitExam(true);
      return;
    }

    ctx.setShell(exam.subject, "模拟考试中", { hideMode: true, showBack: true });
    startTimer(exam.deadlineAt, () => ctx.submitExam(true));

    const question = exam.questions[exam.currentIndex] || exam.questions[0];
    const answer = exam.answers[question.id];
    const root = el("section", "screen exam-taking-screen");
    root.append(renderExamStatus(exam), renderQuestionCard(ctx, exam, question, answer), renderAnswerSheet(ctx, exam));
    window.AppUI.setView(ctx.view, root);
  }

  function renderResult(ctx, examId) {
    stopTimer();
    const result = findResult(ctx, examId);
    if (!result) {
      renderHome(ctx);
      return;
    }

    ctx.setShell("成绩报告", result.subject, { hideMode: true, showBack: true });
    const root = el("section", "screen exam-result-screen");
    const summary = el("div", "exam-result-hero");
    summary.innerHTML = `
      <span>${escapeHtml(result.examId)}</span>
      <strong>${result.score}</strong>
      <em>/ ${result.totalScore} 分</em>
      <p>正确率 ${result.correctRate}% · 已答 ${result.answeredCount}/${result.questionCount} · 待核对 ${result.pendingQuestions.length}</p>
    `;
    root.append(summary);

    const typeList = el("div", "stats-list");
    Object.entries(result.typeScores).forEach(([type, item]) => {
      const row = el("div", "stats-row");
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(typeLabel(type))}</strong>
          <span>${item.earned}/${item.total} 分${item.pending ? ` · 待核对 ${item.pending}分` : ""}</span>
        </div>
        <div class="mini-track"><span style="width:${percent(item.earned, item.total)}%"></span></div>
        <em>${item.total ? Math.round((item.earned / item.total) * 100) : 0}%</em>
      `;
      typeList.append(row);
    });

    const analysis = el("div", "report-card");
    analysis.innerHTML = `
      <strong>薄弱分析</strong>
      <p>${escapeHtml(result.analysis)}</p>
      <strong>推荐复习</strong>
      <ul>${result.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `;

    const wrong = el("div", "report-card");
    const wrongDetails = result.details.filter((item) => !item.correct);
    wrong.innerHTML = `
      <strong>错题列表</strong>
      ${wrongDetails.length ? wrongDetails.map((item) => `
        <button class="report-wrong-row" type="button" data-question-id="${escapeHtml(item.questionId)}">
          <span>#${item.index} · ${escapeHtml(typeLabel(item.type))} · ${item.earned}/${item.maxScore}分</span>
          <em>${escapeHtml(item.question)}</em>
        </button>
      `).join("") : "<p>本次没有错题。</p>"}
    `;
    wrong.addEventListener("click", (event) => {
      const button = event.target.closest("[data-question-id]");
      if (button) ctx.startWrongReview(button.dataset.questionId);
    });

    const actions = el("div", "action-row");
    actions.append(
      window.AppUI.makeButton("ghost-btn", "错题回炉", () => ctx.openWrongBook()),
      window.AppUI.makeButton("primary-btn", "再次考试", () => ctx.startExam(result.subject))
    );

    root.append(typeList, analysis, wrong, actions);
    window.AppUI.setView(ctx.view, root);
  }

  function renderExamStatus(exam) {
    const answered = exam.questions.filter((question) => hasAnswer(exam.answers[question.id])).length;
    const card = el("div", "exam-status-card");
    card.innerHTML = `
      <div>
        <span>剩余时间</span>
        <strong id="examTimer">${formatTime(exam.deadlineAt - Date.now())}</strong>
      </div>
      <div>
        <span>答题进度</span>
        <strong>${answered}/${exam.questions.length}</strong>
      </div>
      <div>
        <span>总分</span>
        <strong>${exam.totalScore}</strong>
      </div>
    `;
    return card;
  }

  function renderQuestionCard(ctx, exam, question, answer) {
    const card = el("article", "question-card exam-question-card");
    card.style.setProperty("--accent", question.accent);
    card.innerHTML = `
      <div class="question-card__head">
        <span>${escapeHtml(typeLabel(question.type))} · ${question.examScore}分</span>
        <span>#${exam.currentIndex + 1}/${exam.questions.length}</span>
      </div>
      <h2>${escapeHtml(question.question).replace(/\n/g, "<br>")}</h2>
      ${question.pendingReview ? `<p class="exam-warning">本题原资料未提供标准答案，提交后进入待核对。</p>` : ""}
    `;
    if (question.questionImages.length) card.append(window.AppUI.renderImageList(question.questionImages, "题目图片"));

    if (["single", "judge"].includes(question.type)) renderSingleChoice(card, ctx, question, answer);
    else if (question.type === "multiple") renderMultipleChoice(card, ctx, question, answer);
    else renderTextAnswer(card, ctx, question, answer);

    const nav = el("div", "exam-nav-row");
    const prev = window.AppUI.makeButton("ghost-btn", "上一题", () => ctx.setExamIndex(Math.max(exam.currentIndex - 1, 0)));
    const next = window.AppUI.makeButton("ghost-btn", "下一题", () => ctx.setExamIndex(Math.min(exam.currentIndex + 1, exam.questions.length - 1)));
    const submit = window.AppUI.makeButton("primary-btn", "提交试卷", () => showSubmitModal(ctx, exam));
    prev.disabled = exam.currentIndex === 0;
    next.disabled = exam.currentIndex === exam.questions.length - 1;
    nav.append(prev, next, submit);
    card.append(nav);
    return card;
  }

  function renderSingleChoice(card, ctx, question, answer) {
    const selected = normalizeLetters(answer);
    const list = el("div", "option-list");
    question.options.forEach((option, index) => {
      const letter = optionLetter(index);
      const button = el("button", "option-btn", "");
      button.type = "button";
      button.classList.toggle("is-selected", selected.includes(letter));
      button.innerHTML = `<span>${letter}</span><strong>${escapeHtml(option)}</strong>`;
      button.addEventListener("click", () => ctx.updateExamAnswer(question.id, [letter]));
      list.append(button);
    });
    card.append(list);
  }

  function renderMultipleChoice(card, ctx, question, answer) {
    const selected = normalizeLetters(answer);
    const list = el("div", "option-list");
    question.options.forEach((option, index) => {
      const letter = optionLetter(index);
      const button = el("button", "option-btn", "");
      button.type = "button";
      button.classList.toggle("is-selected", selected.includes(letter));
      button.innerHTML = `<span>${letter}</span><strong>${escapeHtml(option)}</strong>`;
      button.addEventListener("click", () => {
        const next = selected.includes(letter) ? selected.filter((item) => item !== letter) : [...selected, letter].sort();
        ctx.updateExamAnswer(question.id, next);
      });
      list.append(button);
    });
    card.append(list);
  }

  function renderTextAnswer(card, ctx, question, answer) {
    const field = question.type === "fill" ? el("input", "answer-input", "") : el("textarea", "answer-input answer-input--area", "");
    field.value = String(answer || "");
    field.placeholder = question.type === "fill" ? "请输入答案" : "请输入完整作答";
    if (question.type === "fill") field.type = "text";
    field.addEventListener("input", () => ctx.updateExamAnswer(question.id, field.value, { silent: true }));
    card.append(field);
    if (question.type !== "fill" && question.referenceImages.length) {
      const hint = el("p", "exam-muted", "提交前不会显示参考图或解析。");
      card.append(hint);
    }
  }

  function renderAnswerSheet(ctx, exam) {
    const sheet = el("section", "answer-sheet");
    sheet.innerHTML = `<div class="answer-sheet__head"><strong>答题卡</strong><span>${exam.examId}</span></div>`;
    const grid = el("div", "answer-sheet__grid");
    exam.questions.forEach((question, index) => {
      const button = el("button", "answer-no", String(index + 1));
      button.type = "button";
      button.classList.toggle("is-current", index === exam.currentIndex);
      button.classList.toggle("is-answered", hasAnswer(exam.answers[question.id]));
      button.addEventListener("click", () => ctx.setExamIndex(index));
      grid.append(button);
    });
    sheet.append(grid);
    return sheet;
  }

  function showSubmitModal(ctx, exam) {
    const unanswered = exam.questions.filter((question) => !hasAnswer(exam.answers[question.id])).length;
    const old = document.querySelector(".modal-backdrop");
    old?.remove();
    const modal = el("div", "modal-backdrop", "");
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <strong>提交试卷？</strong>
        <p>${unanswered ? `还有 ${unanswered} 道题未作答，提交后将立即评分。` : "所有题目已作答，提交后将生成成绩报告。"}</p>
        <div class="action-row">
          <button class="ghost-btn" type="button" data-cancel>继续答题</button>
          <button class="primary-btn" type="button" data-submit>确认提交</button>
        </div>
      </div>
    `;
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-cancel]")) modal.remove();
      if (event.target.closest("[data-submit]")) {
        modal.remove();
        ctx.submitExam(false);
      }
    });
    document.body.append(modal);
  }

  function findResult(ctx, examId) {
    if (examId) return ctx.state.examHistory.find((item) => item.examId === examId) || null;
    return ctx.state.latestExamResult || ctx.state.examHistory[0] || null;
  }

  function startTimer(deadlineAt, onExpire) {
    stopTimer();
    timerId = window.setInterval(() => {
      const remain = deadlineAt - Date.now();
      const target = document.querySelector("#examTimer");
      if (target) target.textContent = formatTime(remain);
      if (remain <= 0) {
        stopTimer();
        onExpire();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function normalizeLetters(value) {
    if (Array.isArray(value)) return value.map(String).map((item) => item.toUpperCase()).sort();
    return String(value || "").replace(/[,，\s]+/g, "").split("").map((item) => item.toUpperCase()).filter(Boolean).sort();
  }

  function hasAnswer(answer) {
    return Array.isArray(answer) ? answer.length > 0 : String(answer || "").trim().length > 0;
  }

  return { renderHome, renderTaking, renderResult, stopTimer };
})();
