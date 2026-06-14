window.QuestionBankApp = (() => {
  const elements = {
    view: document.querySelector("#view"),
    pageTitle: document.querySelector("#pageTitle"),
    topEyebrow: document.querySelector("#topEyebrow"),
    backBtn: document.querySelector("#backBtn"),
    modeToggle: document.querySelector("#modeToggle"),
    tabbar: document.querySelector("#tabbar")
  };

  let state = null;
  let repository = null;

  async function init() {
    renderTabs();
    state = window.AppStore.loadState();
    bindShellEvents();
    showLoading();
    try {
      repository = await window.QuestionRepository.load();
      render();
      registerServiceWorker();
    } catch (error) {
      window.AppUI.setView(elements.view, window.AppUI.emptyState("题库加载失败", error.message || "请刷新页面重试。"));
    }
  }

  function renderTabs() {
    elements.tabbar.replaceChildren();
    window.AppConfig.tabs.forEach((tab) => {
      const button = window.AppUI.el("button", "tabbar__item", "");
      button.type = "button";
      button.dataset.tab = tab.key;
      button.innerHTML = `<span class="tabbar__icon">${tab.icon}</span><span>${tab.label}</span>`;
      elements.tabbar.append(button);
    });
  }

  function bindShellEvents() {
    elements.tabbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if (!button) return;
      openTab(button.dataset.tab);
    });

    elements.backBtn.addEventListener("click", goBack);
    elements.modeToggle.addEventListener("click", () => {
      state.mode = state.mode === "sequence" ? "random" : "sequence";
      saveAndRender();
    });
  }

  function openTab(tab) {
    state.currentTab = tab;
    if (tab === "home") state.route = { name: "home" };
    if (tab === "practice") state.route = state.lastPractice ? { name: "quiz", ...state.lastPractice } : { name: "practice" };
    if (tab === "wrongBook") state.route = { name: "wrongBook" };
    if (tab === "stats") state.route = { name: "stats" };
    if (tab === "profile") state.route = { name: "profile" };
    saveAndRender();
  }

  function openSubject(subject) {
    state.currentTab = "home";
    state.route = { name: "subject", subject };
    saveAndRender();
  }

  function startQuiz(subject, type) {
    state.currentTab = "practice";
    state.route = { name: "quiz", subject, type };
    state.lastPractice = { subject, type };
    saveAndRender();
  }

  function openWrongBook() {
    state.currentTab = "wrongBook";
    state.route = { name: "wrongBook" };
    saveAndRender();
  }

  function startWrongReview(questionId) {
    window.ErrorBook.startReview(state, questionId);
    state.currentTab = "wrongBook";
    state.route = { name: "wrongReview", questionId };
    saveAndRender();
  }

  function goBack() {
    const route = state.route || { name: "home" };
    if (route.name === "quiz") {
      state.currentTab = "home";
      state.route = { name: "subject", subject: route.subject };
    } else if (route.name === "subject") {
      state.currentTab = "home";
      state.route = { name: "home" };
    } else if (route.name === "wrongReview") {
      state.currentTab = "wrongBook";
      state.route = { name: "wrongBook" };
    } else {
      state.currentTab = "home";
      state.route = { name: "home" };
    }
    saveAndRender();
  }

  function setShell(title, eyebrow, options = {}) {
    elements.pageTitle.textContent = title;
    elements.topEyebrow.textContent = eyebrow;
    elements.backBtn.classList.toggle("hidden", !options.showBack);
    elements.modeToggle.classList.toggle("hidden", options.hideMode ?? false);
    elements.modeToggle.textContent = state.mode === "sequence" ? "顺序" : "随机";
    elements.modeToggle.classList.toggle("is-random", state.mode === "random");
    updateActiveTab();
  }

  function updateActiveTab() {
    [...elements.tabbar.querySelectorAll("[data-tab]")].forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === state.currentTab);
    });
  }

  function render() {
    updateActiveTab();
    const ctx = buildContext();
    const route = state.route || { name: "home" };

    if (route.name === "home") window.HomePage.render(ctx);
    else if (route.name === "subject") window.SubjectPage.render(ctx, route.subject);
    else if (route.name === "practice") window.QuizPage.renderLanding(ctx);
    else if (route.name === "quiz") window.QuizPage.render(ctx, route);
    else if (route.name === "wrongBook") window.WrongBookPage.render(ctx);
    else if (route.name === "wrongReview") window.QuizPage.renderReview(ctx, route.questionId);
    else if (route.name === "stats") window.StatsPage.render(ctx);
    else if (route.name === "profile") window.ProfilePage.render(ctx);
    else window.HomePage.render(ctx);
  }

  function buildContext() {
    return {
      state,
      repository,
      view: elements.view,
      setShell,
      render,
      saveAndRender,
      openSubject,
      startQuiz,
      openWrongBook,
      startWrongReview
    };
  }

  function saveAndRender() {
    window.AppStore.saveState(state);
    render();
  }

  function showLoading() {
    elements.pageTitle.textContent = "智题库";
    elements.topEyebrow.textContent = "正在加载题库";
    elements.modeToggle.classList.add("hidden");
    elements.backBtn.classList.add("hidden");
    window.AppUI.setView(elements.view, window.AppUI.emptyState("加载中", "正在读取 JSON 题库。"));
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`./sw.js?v=${window.AppConfig.VERSION}`).catch(() => {});
    }
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => window.QuestionBankApp.init());
