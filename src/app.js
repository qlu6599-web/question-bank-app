(() => {
const APP_VERSION = "20260614-v7";
const { questionBank, flatQuestions } = window.QuestionData;
const analyticsService = window.AnalyticsService;
const aiTutorService = window.AiTutorService;
const cloudSyncService = window.CloudSyncService;
const userService = window.UserService;
const { loadState, resetStudyState, saveState } = window.AppStore;
const { el, optionLetter, percent, setView } = window.DomUtils;

const view = document.querySelector("#view");
const pageTitle = document.querySelector("#pageTitle");
const topEyebrow = document.querySelector("#topEyebrow");
const backBtn = document.querySelector("#backBtn");
const modeToggle = document.querySelector("#modeToggle");
const tabButtons = [...document.querySelectorAll(".tabbar__item")];
const state = loadState();

function init() {
  bindShellEvents();
  render();
  registerServiceWorker();
}

function bindShellEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.currentTab = button.dataset.tab;
      if (state.currentTab !== "home") state.selectedSubject = null;
      saveState(state);
      render();
    });
  });

  backBtn.addEventListener("click", () => {
    state.selectedSubject = null;
    state.currentTab = "home";
    saveState(state);
    render();
  });

  modeToggle.addEventListener("click", () => {
    state.mode = state.mode === "sequence" ? "random" : "sequence";
    saveState(state);
    render();
  });
}

function setShell(title, eyebrow, options = {}) {
  pageTitle.textContent = title;
  topEyebrow.textContent = eyebrow;
  backBtn.classList.toggle("hidden", !options.showBack);
  modeToggle.textContent = state.mode === "sequence" ? "顺序" : "随机";
  modeToggle.classList.toggle("is-random", state.mode === "random");
  modeToggle.classList.toggle("hidden", options.hideMode ?? false);

  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.currentTab);
  });
}

function render() {
  if (state.currentTab === "home" && state.selectedSubject) {
    renderPractice(state.selectedSubject);
    return;
  }

  const renderMap = {
    home: renderHome,
    mistakes: renderMistakes,
    stats: renderStats,
    profile: renderProfile
  };

  renderMap[state.currentTab]();
}

function renderHome() {
  setShell("智题库", "选择科目开始练习");
  const root = el("section", "screen screen--home");
  const hero = el("div", "hero-card");
  const summary = analyticsService.summarize(state, flatQuestions);
  hero.innerHTML = `
    <div>
      <p class="hero-card__label">今日学习</p>
      <h2>${summary.totalAnswered} / ${summary.totalQuestions}</h2>
      <p>正确率 ${summary.accuracy}% · 错题 ${summary.wrongCount} 道</p>
    </div>
    <div class="hero-card__ring" style="--value:${summary.accuracy * 3.6}deg"><span>${summary.accuracy}%</span></div>
  `;
  root.append(hero);

  const grid = el("div", "subject-grid");
  questionBank.forEach((subject) => {
    const done = subject.questions.filter((question) => state.answers[question.id]).length;
    const card = el("button", "subject-card", "");
    card.type = "button";
    card.style.setProperty("--accent", subject.accent);
    card.innerHTML = `
      <span class="subject-card__mark"></span>
      <strong>${subject.subject}</strong>
      <span>${subject.description}</span>
      <em>${done}/${subject.questions.length} 已完成</em>
    `;
    card.addEventListener("click", () => {
      state.selectedSubject = subject.subject;
      state.currentTab = "home";
      saveState(state);
      render();
    });
    grid.append(card);
  });
  root.append(grid);
  setView(view, root);
}

function renderPractice(subjectName, mistakeOnly = false) {
  const sourceQuestions = mistakeOnly ? getMistakeQuestions() : getSubjectQuestions(subjectName);
  const title = mistakeOnly ? "错题重练" : subjectName;
  setShell(title, mistakeOnly ? "巩固薄弱知识点" : "单题练习", { showBack: !mistakeOnly });

  if (!sourceQuestions.length) {
    renderEmptyState(mistakeOnly ? "暂无错题" : "暂无题目", mistakeOnly ? "答错的题会自动进入错题本。" : "当前科目还没有题目数据。");
    return;
  }

  const currentIndex = getCurrentIndex(subjectName, sourceQuestions.length, mistakeOnly);
  const question = sourceQuestions[currentIndex];
  const answerRecord = state.answers[question.id];
  const correctLetters = normalizeLetters(question.answer);
  const isChoice = hasChoiceOptions(question);
  const isMulti = isChoice && correctLetters.length > 1;
  const isCloze = question.type === "cloze";
  const isSubjective = ["qa", "design", "application", "comprehensive"].includes(question.type);
  const tempSelected = state.tempSelections?.[question.id] || [];
  const root = el("section", "screen practice-screen");
  const progressCard = el("div", "progress-card");
  const answeredInSet = sourceQuestions.filter((item) => state.answers[item.id]).length;
  const accuracy = getAccuracyForQuestions(sourceQuestions);
  progressCard.innerHTML = `
    <div class="progress-card__row">
      <span>进度 ${currentIndex + 1}/${sourceQuestions.length}</span>
      <strong>${accuracy}%</strong>
    </div>
    <div class="progress-track"><span style="width:${percent(answeredInSet, sourceQuestions.length)}%"></span></div>
    <div class="progress-card__meta">
      <span>已完成 ${answeredInSet}</span>
      <span>${state.mode === "sequence" ? "顺序模式" : "随机模式"}</span>
    </div>
  `;

  const card = el("article", "question-card");
  card.style.setProperty("--accent", question.accent);
  card.innerHTML = `
    <div class="question-card__head">
      <span>${question.subject}</span>
      <span>#${currentIndex + 1}</span>
    </div>
    <h2>${question.question}</h2>
  `;
  if (Array.isArray(question.questionImages) && question.questionImages.length) {
    card.append(renderImageList(question.questionImages, "题目图片"));
  }

  if (isChoice) {
    const options = el("div", "option-list");
    question.options.forEach((option, index) => {
      const letter = optionLetter(index);
      const button = el("button", "option-btn", "");
      const selectedLetters = answerRecord ? normalizeLetters(answerRecord.selected) : tempSelected;
      const isSelected = selectedLetters.includes(letter);
      const isCorrect = correctLetters.includes(letter);
      button.type = "button";
      button.innerHTML = `<span>${letter}</span><strong>${option}</strong>`;
      if (answerRecord) {
        button.disabled = true;
        if (answerRecord.unscored) button.classList.toggle("is-selected", isSelected);
        else {
          button.classList.toggle("is-correct", isCorrect);
          button.classList.toggle("is-wrong", isSelected && !isCorrect);
        }
      } else if (isMulti) {
        button.classList.toggle("is-selected", isSelected);
        button.addEventListener("click", () => toggleMultiSelection(question.id, letter));
      } else {
        button.addEventListener("click", () => handleChoiceAnswer(question, [letter]));
      }
      options.append(button);
    });
    card.append(options);
  }

  if (isMulti && !answerRecord) {
    const actions = el("div", "action-row");
    const hint = el("button", "ghost-btn", `已选 ${tempSelected.length}`);
    const submitButton = el("button", "primary-btn", "提交答案");
    hint.type = "button";
    submitButton.type = "button";
    hint.disabled = true;
    submitButton.disabled = tempSelected.length === 0;
    submitButton.addEventListener("click", () => handleChoiceAnswer(question, tempSelected));
    actions.append(hint, submitButton);
    card.append(actions);
  }

  if ((isCloze || isSubjective) && !answerRecord) {
    const form = el("form", "answer-form", "");
    const field = isSubjective ? el("textarea", "answer-input answer-input--area", "") : el("input", "answer-input", "");
    const submitButton = el("button", "primary-btn", isSubjective ? "提交并查看参考答案" : "提交答案");
    field.name = "answer";
    field.placeholder = isSubjective ? "在这里写下你的作答..." : "请输入填空答案";
    if (!isSubjective) field.type = "text";
    submitButton.type = "submit";
    form.append(field, submitButton);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(new FormData(form).get("answer") || "").trim();
      if (!value) {
        showToast("先写下答案再提交。");
        return;
      }
      if (isSubjective) handleSubjectiveSubmit(question, value);
      else handleClozeAnswer(question, value);
    });
    card.append(form);
  }

  if (answerRecord) {
    const feedbackClass = answerRecord.unscored ? "feedback--pending" : answerRecord.correct ? "feedback--right" : "feedback--wrong";
    const feedback = el("div", `feedback ${feedbackClass}`);
    feedback.innerHTML = buildFeedbackHtml(question, answerRecord, correctLetters);
    card.append(feedback);

    if (isSubjective && answerRecord.needsReview) {
      const review = el("div", "action-row");
      const wrongButton = el("button", "ghost-btn", "未掌握");
      const rightButton = el("button", "primary-btn", "已掌握");
      wrongButton.type = "button";
      rightButton.type = "button";
      wrongButton.addEventListener("click", () => markSubjective(question, false));
      rightButton.addEventListener("click", () => markSubjective(question, true));
      review.append(wrongButton, rightButton);
      card.append(review);
    }

    const actions = el("div", "action-row");
    const aiButton = el("button", "ghost-btn", "AI讲题");
    const nextButton = el("button", "primary-btn", currentIndex === sourceQuestions.length - 1 ? "完成本组" : "下一题");
    aiButton.type = "button";
    nextButton.type = "button";
    aiButton.addEventListener("click", async () => {
      const result = await aiTutorService.explainQuestion(question, answerRecord.selected);
      showToast(result.message);
    });
    nextButton.addEventListener("click", () => goNext(subjectName, sourceQuestions.length, mistakeOnly));
    actions.append(aiButton, nextButton);
    card.append(actions);
  }

  root.append(progressCard, card);
  setView(view, root);
}

function renderMistakes() {
  state.currentTab = "mistakes";
  setShell("错题本", "自动收集答错题目", { hideMode: false });
  renderPractice("错题本", true);
}

function renderStats() {
  setShell("学习统计", "数据分析模块预留", { hideMode: true });
  const summary = analyticsService.summarize(state, flatQuestions);
  const root = el("section", "screen stats-screen");
  const cards = el("div", "metric-grid");
  [
    ["已完成", summary.totalAnswered, "题"],
    ["正确率", summary.accuracy, "%"],
    ["错题数", summary.wrongCount, "题"],
    ["总题量", summary.totalQuestions, "题"]
  ].forEach(([label, value, unit]) => {
    const card = el("div", "metric-card");
    card.innerHTML = `<span>${label}</span><strong>${value}</strong><em>${unit}</em>`;
    cards.append(card);
  });

  const list = el("div", "stats-list");
  Object.entries(summary.subjectStats).forEach(([subject, item]) => {
    const rate = item.scored ? Math.round((item.correct / item.scored) * 100) : 0;
    const row = el("div", "stats-row");
    row.innerHTML = `
      <div>
        <strong>${subject}</strong>
        <span>${item.answered}/${item.total} 已完成</span>
      </div>
      <div class="mini-track"><span style="width:${rate}%"></span></div>
      <em>${rate}%</em>
    `;
    list.append(row);
  });

  root.append(cards, list);
  setView(view, root);
}

function renderProfile() {
  setShell("我的", "用户系统占位", { hideMode: true });
  const user = userService.getCurrentUser();
  const root = el("section", "screen profile-screen");
  const profile = el("div", "profile-card");
  profile.innerHTML = `
    <div class="avatar">${user.name.slice(0, 1)}</div>
    <div>
      <h2>${user.name}</h2>
      <p>${user.plan}</p>
    </div>
  `;

  const actions = el("div", "settings-list");
  const login = settingButton(user.id === "guest" ? "Demo 登录" : "退出登录", user.id === "guest" ? "体验用户系统预留入口" : "清除本地 Demo 用户", () => {
    if (user.id === "guest") userService.loginDemo();
    else userService.logout();
    render();
  });
  const sync = settingButton("云同步", "预留 API，当前保存到本地草稿", async () => {
    const result = await cloudSyncService.pushProgress(state);
    showToast(result.ok ? "已写入本地同步草稿，后续可替换为云端 API。" : "同步失败");
  });
  const reset = settingButton("重置练习数据", "清空答题、错题和进度", () => {
    resetStudyState(state);
    showToast("练习数据已重置。");
    render();
  });
  actions.append(login, sync, reset);
  root.append(profile, actions);
  setView(view, root);
}

function settingButton(title, desc, onClick) {
  const button = el("button", "setting-row", "");
  button.type = "button";
  button.innerHTML = `<span><strong>${title}</strong><em>${desc}</em></span><b>›</b>`;
  button.addEventListener("click", onClick);
  return button;
}

function toggleMultiSelection(questionId, letter) {
  state.tempSelections ||= {};
  const current = state.tempSelections[questionId] || [];
  state.tempSelections[questionId] = current.includes(letter)
    ? current.filter((item) => item !== letter)
    : [...current, letter].sort();
  saveState(state);
  render();
}

function handleChoiceAnswer(question, selected) {
  const selectedLetters = normalizeLetters(selected);
  const correctLetters = normalizeLetters(question.answer);
  const unscored = question.unscored || correctLetters.length === 0;
  const correct = unscored ? null : selectedLetters.join("") === correctLetters.join("");
  recordAnswer(question, {
    selected: selectedLetters,
    correct,
    unscored,
    answeredAt: new Date().toISOString()
  });
}

function handleClozeAnswer(question, value) {
  const acceptedAnswers = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
    ? question.acceptedAnswers
    : [question.answerText || question.answer];
  const actual = normalizeTextAnswer(value);
  const correct = acceptedAnswers.some((answer) => normalizeTextAnswer(answer) === actual);
  recordAnswer(question, {
    selected: value,
    correct,
    answeredAt: new Date().toISOString()
  });
}

function handleSubjectiveSubmit(question, value) {
  recordAnswer(question, {
    selected: value,
    correct: false,
    needsReview: true,
    answeredAt: new Date().toISOString()
  }, { keepReviewOpen: true });
}

function markSubjective(question, correct) {
  const current = state.answers[question.id] || {};
  recordAnswer(question, {
    ...current,
    correct,
    needsReview: false,
    reviewedAt: new Date().toISOString()
  });
}

function recordAnswer(question, answerRecord, options = {}) {
  state.answers[question.id] = answerRecord;
  if (state.tempSelections) delete state.tempSelections[question.id];
  if (!state.completedIds.includes(question.id)) state.completedIds.push(question.id);
  if (answerRecord.unscored) state.mistakes = state.mistakes.filter((id) => id !== question.id);
  else if (!answerRecord.correct && !state.mistakes.includes(question.id)) state.mistakes.push(question.id);
  if (answerRecord.correct) state.mistakes = state.mistakes.filter((id) => id !== question.id);
  saveState(state);
  render();
}

function buildFeedbackHtml(question, answerRecord, correctLetters) {
  if (question.type === "cloze") {
    const expected = escapeHtml(question.answerText || question.answer);
    const selected = escapeHtml(answerRecord.selected || "");
    return answerRecord.correct
      ? `<strong>回答正确</strong><p>你的答案：${selected}</p>`
      : `<strong>回答错误</strong><p>你的答案：${selected}</p><p>参考答案：${expected}</p><p>${escapeHtml(question.analysis || "")}</p>`;
  }
  if (["qa", "design", "application", "comprehensive"].includes(question.type)) {
    const selected = escapeHtml(answerRecord.selected || "");
    const reference = escapeHtml(question.referenceAnswer || question.analysis || "参考资料未提供答案。").replace(/\n/g, "<br>");
    const status = answerRecord.needsReview ? "请对照参考答案自评" : answerRecord.correct ? "已标记掌握" : "已标记未掌握";
    const images = renderReferenceImagesHtml(question.referenceImages);
    return `<strong>${status}</strong><p>你的作答：${selected}</p><p class="reference-answer">参考答案：<br>${reference}</p>${images}`;
  }
  if (answerRecord.unscored) {
    const selected = normalizeLetters(answerRecord.selected).join("");
    return `<strong>已记录选择</strong><p>你的选择：${escapeHtml(selected)}</p><p>${escapeHtml(question.analysis || "原资料未提供答案，暂不计入正确率。")}</p>`;
  }
  const answerText = correctLetters.join("");
  return answerRecord.correct
    ? `<strong>回答正确</strong><p>做得漂亮，继续保持。</p>`
    : `<strong>回答错误，正确答案是 ${answerText}</strong><p>${escapeHtml(question.analysis || "")}</p>`;
}

function normalizeLetters(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).sort();
  return String(value || "")
    .replace(/[,，\s]+/g, "")
    .split("")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

function normalizeTextAnswer(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，。,.、；;：:（）()]/g, "")
    .toLowerCase();
}

function hasChoiceOptions(question) {
  return Array.isArray(question.options) && question.options.length >= 2;
}

function renderImageList(images, label) {
  const wrap = el("div", "image-list", "");
  images.forEach((src, index) => {
    const figure = el("figure", "answer-figure", "");
    figure.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(label)} ${index + 1}" loading="lazy" />`;
    wrap.append(figure);
  });
  return wrap;
}

function renderReferenceImagesHtml(images) {
  if (!Array.isArray(images) || !images.length) return "";
  return `<div class="image-list">${images
    .map((src, index) => `<figure class="answer-figure"><img src="${escapeHtml(src)}" alt="参考答案图片 ${index + 1}" loading="lazy" /></figure>`)
    .join("")}</div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function goNext(subjectName, length, mistakeOnly) {
  if (state.mode === "random") {
    const next = Math.floor(Math.random() * length);
    if (mistakeOnly) state.currentMistakeIndex = next;
    else state.currentIndexBySubject[subjectName] = next;
  } else if (mistakeOnly) {
    state.currentMistakeIndex = (state.currentMistakeIndex + 1) % length;
  } else {
    state.currentIndexBySubject[subjectName] = ((state.currentIndexBySubject[subjectName] || 0) + 1) % length;
  }
  saveState(state);
  render();
}

function getSubjectQuestions(subjectName) {
  return flatQuestions.filter((question) => question.subject === subjectName);
}

function getMistakeQuestions() {
  return state.mistakes.map((id) => flatQuestions.find((question) => question.id === id)).filter(Boolean);
}

function getCurrentIndex(subjectName, length, mistakeOnly) {
  const index = mistakeOnly ? state.currentMistakeIndex : state.currentIndexBySubject[subjectName] || 0;
  return Math.min(index, Math.max(length - 1, 0));
}

function getAccuracyForQuestions(questions) {
  const scored = questions
    .map((question) => state.answers[question.id])
    .filter((answer) => answer && !answer.unscored && !answer.needsReview);
  if (!scored.length) return 0;
  return Math.round((scored.filter((answer) => answer.correct).length / scored.length) * 100);
}

function renderEmptyState(title, text) {
  const root = el("section", "screen empty-screen");
  root.innerHTML = `<div class="empty-card"><strong>${title}</strong><p>${text}</p></div>`;
  setView(view, root);
}

function showToast(message) {
  const old = document.querySelector(".toast");
  old?.remove();
  const toast = el("div", "toast", message);
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.setTimeout(() => toast.remove(), 3200);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`).catch(() => {});
  }
}

init();
})();
