window.AppStore = (() => {
  const STORAGE_KEY = "question-bank-state-v6";
  const LEGACY_STORAGE_KEY_V5 = "question-bank-state-v5";
  const LEGACY_STORAGE_KEY = "question-bank-state-v4";

  const defaultState = {
    currentTab: "home",
    route: { name: "home" },
    mode: "sequence",
    answers: {},
    mistakes: [],
    completedIds: [],
    tempSelections: {},
    indexByScope: {},
    wrongPractice: {
      questionId: null,
      subject: null,
      questionIds: [],
      currentIndex: 0,
      answers: {}
    },
    mixedPractice: {
      active: null,
      history: [],
      usedBySubject: {}
    },
    activeExam: null,
    examHistory: [],
    latestExamResult: null,
    lastPractice: null,
    lastVisitedAt: null
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    const saved = readJson(STORAGE_KEY);
    if (saved) return ensureShape(saved);
    const v5 = readJson(LEGACY_STORAGE_KEY_V5);
    if (v5) return migrateLegacyState(v5);
    const legacy = readJson(LEGACY_STORAGE_KEY);
    return legacy ? migrateLegacyState(legacy) : cloneDefault();
  }

  function saveState(state) {
    const snapshot = ensureShape(state);
    snapshot.lastVisitedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  function resetStudyState(state) {
    state.answers = {};
    state.mistakes = [];
    state.completedIds = [];
    state.tempSelections = {};
    state.indexByScope = {};
    state.wrongPractice = { questionId: null, subject: null, questionIds: [], currentIndex: 0, answers: {} };
    state.mixedPractice = { active: null, history: [], usedBySubject: {} };
    state.activeExam = null;
    state.examHistory = [];
    state.latestExamResult = null;
    saveState(state);
  }

  function ensureShape(state) {
    const next = { ...cloneDefault(), ...state };
    next.route = next.route || { name: "home" };
    next.answers = next.answers || {};
    next.mistakes = Array.isArray(next.mistakes) ? next.mistakes : [];
    next.completedIds = Array.isArray(next.completedIds) ? next.completedIds : [];
    next.tempSelections = next.tempSelections || {};
    next.indexByScope = next.indexByScope || {};
    next.wrongPractice = {
      questionId: next.wrongPractice?.questionId || null,
      subject: next.wrongPractice?.subject || null,
      questionIds: Array.isArray(next.wrongPractice?.questionIds) ? next.wrongPractice.questionIds : [],
      currentIndex: Number.isFinite(next.wrongPractice?.currentIndex) ? next.wrongPractice.currentIndex : 0,
      answers: next.wrongPractice?.answers || {}
    };
    next.mixedPractice = {
      active: next.mixedPractice?.active || null,
      history: Array.isArray(next.mixedPractice?.history) ? next.mixedPractice.history : [],
      usedBySubject: next.mixedPractice?.usedBySubject || {}
    };
    next.activeExam = next.activeExam || null;
    next.examHistory = Array.isArray(next.examHistory) ? next.examHistory : [];
    next.latestExamResult = next.latestExamResult || null;
    return next;
  }

  function migrateLegacyState(legacy) {
    const state = ensureShape({
      currentTab: "home",
      route: { name: "home" },
      mode: legacy.mode || "sequence",
      answers: legacy.answers || {},
      mistakes: legacy.mistakes || [],
      completedIds: legacy.completedIds || [],
      tempSelections: legacy.tempSelections || {},
      indexByScope: legacy.currentIndexBySubject || {}
    });
    saveState(state);
    return state;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  return { loadState, saveState, resetStudyState };
})();
