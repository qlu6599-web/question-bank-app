window.QuizPage = (() => {
  const { el, optionLetter, percent, escapeHtml, typeLabel, imageListHtml } = window.AppUI;

  function renderLanding(ctx) {
    ctx.setShell("刷题", "选择科目和题型", { hideMode: true, showBack: false });
    const root = el("section", "screen practice-landing");

    if (ctx.state.lastPractice) {
      const { subject, type } = ctx.state.lastPractice;
      const recent = el("button", "continue-card", "");
      recent.type = "button";
      recent.innerHTML = `<span>继续练习</span><strong>${subject} · ${typeLabel(type)}</strong><em>从上次进度开始</em>`;
      recent.addEventListener("click", () => ctx.startQuiz(subject, type));
      root.append(recent);
    }

    const list = el("div", "subject-grid");
    window.QuestionRepository.getSubjects(ctx.repository).forEach((subject) => {
      const card = el("button", "subject-card", "");
      card.type = "button";
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <span class="subject-card__mark"></span>
        <strong>${subject.name}</strong>
        <span>${subject.description}</span>
        <em>选择题型</em>
      `;
      card.addEventListener("click", () => ctx.openSubject(subject.name));
      list.append(card);
    });
    root.append(list);
    window.AppUI.setView(ctx.view, root);
  }

  function render(ctx, params) {
    const { subject, type } = params;
    const questions = window.QuestionRepository.getQuestions(ctx.repository, { subject, type });
    ctx.setShell(subject, typeLabel(type), { hideMode: false, showBack: true });

    if (!questions.length) {
      window.AppUI.setView(ctx.view, window.AppUI.emptyState("暂无题目", "当前分类还没有题目数据。"));
      return;
    }

    const currentIndex = window.QuizEngine.getCurrentIndex(ctx.state, subject, type, questions.length);
    const question = questions[currentIndex];
    const answerRecord = ctx.state.answers[question.id] || null;
    renderQuestion(ctx, {
      questions,
      question,
      currentIndex,
      answerRecord,
      reviewMode: false,
      onSubmit: (selected) => {
        const record = window.QuizEngine.evaluate(question, selected);
        window.ErrorBook.recordAnswer(ctx.state, question, record);
        ctx.saveAndRender();
      },
      onSubjectiveMark: (correct) => {
        const current = ctx.state.answers[question.id];
        if (!current) return;
        window.ErrorBook.recordAnswer(ctx.state, question, window.QuizEngine.markSubjective(current, correct));
        ctx.saveAndRender();
      },
      onNext: () => {
        window.QuizEngine.goNext(ctx.state, subject, type, questions.length);
        ctx.saveAndRender();
      }
    });
  }

  function renderReview(ctx, questionId) {
    const question = window.QuestionRepository.getById(ctx.repository, questionId);
    if (!question) {
      ctx.openWrongBook();
      return;
    }
    ctx.setShell("错题重练", `${question.subject} · ${typeLabel(question.type)}`, { hideMode: true, showBack: true });
    const answerRecord = window.ErrorBook.getReviewAnswer(ctx.state, question.id);
    renderQuestion(ctx, {
      questions: [question],
      question,
      currentIndex: 0,
      answerRecord,
      reviewMode: true,
      onSubmit: (selected) => {
        const record = window.QuizEngine.evaluate(question, selected);
        window.ErrorBook.recordReviewAnswer(ctx.state, question, record);
        ctx.saveAndRender();
      },
      onSubjectiveMark: (correct) => {
        window.ErrorBook.markReviewSubjective(ctx.state, question, correct);
        ctx.saveAndRender();
      },
      onNext: () => ctx.openWrongBook(),
      onRetry: () => {
        window.ErrorBook.startReview(ctx.state, question.id);
        ctx.saveAndRender();
      }
    });
  }

  function renderQuestion(ctx, config) {
    const { questions, question, currentIndex, answerRecord, reviewMode, onSubmit, onSubjectiveMark, onNext, onRetry } = config;
    const mode = window.QuizEngine.getMode(question);
    const isChoice = window.QuizEngine.isChoice(question);
    const isMulti = mode === "choice-multiple";
    const selectionKey = reviewMode ? `review:${question.id}` : question.id;
    const tempSelected = ctx.state.tempSelections[selectionKey] || [];
    const interactionState = answerRecord ? "submitted" : "answering";
    const answeredInSet = questions.filter((item) => ctx.state.answers[item.id]).length;
    const accuracy = getAccuracy(ctx.state, questions);
    const root = el("section", "screen practice-screen");

    const progressCard = el("div", "progress-card");
    progressCard.innerHTML = `
      <div class="progress-card__row">
        <span>进度 ${currentIndex + 1}/${questions.length}</span>
        <strong>${accuracy}%</strong>
      </div>
      <div class="progress-track"><span style="width:${percent(answeredInSet, questions.length)}%"></span></div>
      <div class="progress-card__meta">
        <span>已完成 ${answeredInSet}</span>
        <span>${reviewMode ? "错题重答" : ctx.state.mode === "sequence" ? "顺序模式" : "随机模式"}</span>
      </div>
    `;

    const card = el("article", "question-card");
    card.style.setProperty("--accent", question.accent);
    card.innerHTML = `
      <div class="question-card__head">
        <span>${escapeHtml(question.subject)} · ${escapeHtml(typeLabel(question.type))}</span>
        <span>#${currentIndex + 1}</span>
      </div>
      <h2>${escapeHtml(question.question).replace(/\n/g, "<br>")}</h2>
    `;

    if (question.questionImages.length) {
      card.append(window.AppUI.renderImageList(question.questionImages, "题目图片"));
    }

    if (isChoice) renderChoiceOptions(card, question, answerRecord, tempSelected, isMulti, selectionKey, ctx, onSubmit, interactionState);
    if (!answerRecord && mode === "text") renderTextAnswer(card, question, onSubmit);
    if (!answerRecord && mode === "essay") renderEssayAnswer(card, question, onSubmit);
    if (answerRecord) renderAnsweredState(card, question, answerRecord, reviewMode, onSubjectiveMark, onNext, onRetry);

    root.append(progressCard, card);
    window.AppUI.setView(ctx.view, root);
  }

  function renderChoiceOptions(card, question, answerRecord, tempSelected, isMulti, selectionKey, ctx, onSubmit, interactionState) {
    const correctLetters = window.QuizEngine.normalizeLetters(question.answer);
    const requiresSubmit = isMulti || question.type === "judge";
    const options = el("div", "option-list");
    question.options.forEach((option, index) => {
      const letter = optionLetter(index);
      const button = el("button", "option-btn", "");
      const selectedLetters = answerRecord ? window.QuizEngine.normalizeLetters(answerRecord.selected) : tempSelected;
      const isSelected = selectedLetters.includes(letter);
      const isCorrect = correctLetters.includes(letter);
      button.type = "button";
      button.innerHTML = `<span>${letter}</span><strong>${escapeHtml(option)}</strong>`;

      if (interactionState === "submitted") {
        button.disabled = true;
        if (answerRecord.unscored) button.classList.toggle("is-selected", isSelected);
        else {
          button.classList.toggle("is-correct", isCorrect);
          button.classList.toggle("is-wrong", isSelected && !isCorrect);
        }
      } else if (requiresSubmit) {
        button.classList.toggle("is-selected", isSelected);
        button.addEventListener("click", () => {
          if (isMulti) toggleMultiSelection(ctx, selectionKey, letter);
          else setSingleSelection(ctx, selectionKey, letter);
        });
      } else {
        button.addEventListener("click", () => onSubmit([letter]));
      }
      options.append(button);
    });
    card.append(options);

    if (requiresSubmit && interactionState === "answering") {
      const actions = el("div", "action-row");
      const selectedInfo = window.AppUI.makeButton("ghost-btn", `已选 ${tempSelected.length}`);
      selectedInfo.disabled = true;
      const submitButton = window.AppUI.makeButton("primary-btn", "提交答案", () => onSubmit(tempSelected));
      submitButton.disabled = tempSelected.length === 0;
      actions.append(selectedInfo, submitButton);
      card.append(actions);
    }
  }

  function renderTextAnswer(card, question, onSubmit) {
    const form = el("form", "answer-form", "");
    const field = el("input", "answer-input", "");
    field.name = "answer";
    field.type = "text";
    field.placeholder = "请输入填空答案";
    const button = el("button", "primary-btn", "提交答案");
    button.type = "submit";
    form.append(field, button);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(new FormData(form).get("answer") || "").trim();
      if (!value) {
        window.AppUI.showToast("先写下答案再提交。");
        return;
      }
      onSubmit(value);
    });
    card.append(form);
  }

  function renderEssayAnswer(card, question, onSubmit) {
    const form = el("form", "answer-form", "");
    const field = el("textarea", "answer-input answer-input--area", "");
    field.name = "answer";
    field.placeholder = "在这里写下你的作答...";
    const button = el("button", "primary-btn", window.AppConfig.types[question.type]?.submitText || "提交并查看解析");
    button.type = "submit";
    form.append(field, button);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(new FormData(form).get("answer") || "").trim();
      if (!value) {
        window.AppUI.showToast("先写下答案再提交。");
        return;
      }
      onSubmit(value);
    });
    card.append(form);
  }

  function renderAnsweredState(card, question, answerRecord, reviewMode, onSubjectiveMark, onNext, onRetry) {
    const feedback = el("div", `feedback ${feedbackClass(answerRecord)}`);
    feedback.innerHTML = buildFeedbackHtml(question, answerRecord);
    card.append(feedback);

    if (answerRecord.needsReview) {
      const review = el("div", "action-row");
      review.append(
        window.AppUI.makeButton("ghost-btn", "未掌握", () => onSubjectiveMark(false)),
        window.AppUI.makeButton("primary-btn", "已掌握", () => onSubjectiveMark(true))
      );
      card.append(review);
      return;
    }

    const actions = el("div", "action-row");
    actions.append(window.AppUI.makeButton("ghost-btn", "AI讲题", async () => {
      const result = await window.AiTutorService.explainQuestion(question, answerRecord.selected);
      window.AppUI.showToast(result.message);
    }));
    if (reviewMode && onRetry) actions.append(window.AppUI.makeButton("ghost-btn", "再做一次", onRetry));
    actions.append(window.AppUI.makeButton("primary-btn", reviewMode ? "返回错题本" : "下一题", onNext));
    card.append(actions);
  }

  function buildFeedbackHtml(question, answerRecord) {
    if (answerRecord.unscored) {
      const selected = formatSelected(question, answerRecord.selected);
      return `<strong>已记录作答</strong><p>你的答案：${escapeHtml(selected)}</p><p>${escapeHtml(question.analysis || "原资料未提供答案，暂不计入正确率。")}</p>`;
    }

    if (question.type === "fill") {
      const selected = escapeHtml(answerRecord.selected || "");
      const expected = escapeHtml(question.answer || "");
      return answerRecord.correct
        ? `<strong>回答正确</strong><p>你的答案：${selected}</p>`
        : `<strong>回答错误</strong><p>你的答案：${selected}</p><p>参考答案：${expected}</p><p>${escapeHtml(question.analysis)}</p>`;
    }

    if (window.QuizEngine.isSubjective(question)) {
      const selected = escapeHtml(answerRecord.selected || "").replace(/\n/g, "<br>");
      const reference = escapeHtml(question.referenceAnswer || question.answer || question.analysis || "原资料未提供参考答案。").replace(/\n/g, "<br>");
      const status = answerRecord.needsReview ? "请对照解析自评" : answerRecord.correct ? "已标记掌握" : "已标记未掌握";
      return `<strong>${status}</strong><p>你的作答：${selected}</p><p class="reference-answer">参考解析：<br>${reference}</p>${imageListHtml(question.referenceImages, "参考答案图片")}`;
    }

    const selected = formatSelected(question, answerRecord.selected);
    const expected = formatSelected(question, window.QuizEngine.normalizeLetters(question.answer));
    return answerRecord.correct
      ? `<strong>回答正确</strong><p>你的答案：${escapeHtml(selected)}</p>`
      : `<strong>回答错误</strong><p>你的答案：${escapeHtml(selected)}</p><p>参考答案：${escapeHtml(expected)}</p><p>${escapeHtml(question.analysis)}</p>`;
  }

  function feedbackClass(answerRecord) {
    if (answerRecord.unscored || answerRecord.needsReview) return "feedback--pending";
    return answerRecord.correct ? "feedback--right" : "feedback--wrong";
  }

  function formatSelected(question, selected) {
    const letters = window.QuizEngine.normalizeLetters(selected);
    if (!letters.length) return "";
    return letters.map((letter) => {
      const option = question.options[letter.charCodeAt(0) - 65];
      return option ? `${letter}. ${option}` : letter;
    }).join("；");
  }

  function toggleMultiSelection(ctx, key, letter) {
    ctx.state.tempSelections ||= {};
    const current = ctx.state.tempSelections[key] || [];
    ctx.state.tempSelections[key] = current.includes(letter)
      ? current.filter((item) => item !== letter)
      : [...current, letter].sort();
    ctx.saveAndRender();
  }

  function setSingleSelection(ctx, key, letter) {
    ctx.state.tempSelections ||= {};
    ctx.state.tempSelections[key] = [letter];
    ctx.saveAndRender();
  }

  function getAccuracy(state, questions) {
    const scored = questions
      .map((question) => state.answers[question.id])
      .filter((answer) => answer && !answer.unscored && !answer.needsReview);
    if (!scored.length) return 0;
    return Math.round((scored.filter((answer) => answer.correct).length / scored.length) * 100);
  }

  return { renderLanding, render, renderReview };
})();
