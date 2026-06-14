window.AppStore = (() => {
  const STORAGE_KEY = "question-bank-state-v5";
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
      answers: {}
    },
    lastPractice: null,
    lastVisitedAt: null
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    const saved = readJson(STORAGE_KEY);
    if (saved) return ensureShape(saved);
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
    state.wrongPractice = { questionId: null, answers: {} };
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
      answers: next.wrongPractice?.answers || {}
    };
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
