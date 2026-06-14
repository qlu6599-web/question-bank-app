window.AppStore = (() => {
const STORAGE_KEY = "question-bank-state-v2";

const defaultState = {
  currentTab: "home",
  selectedSubject: null,
  currentIndexBySubject: {},
  currentMistakeIndex: 0,
  mode: "sequence",
  answers: {},
  mistakes: [],
  completedIds: [],
  tempSelections: {},
  lastVisitedAt: null
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastVisitedAt: new Date().toISOString() }));
}

function resetStudyState(state) {
  state.answers = {};
  state.mistakes = [];
  state.completedIds = [];
  state.tempSelections = {};
  state.currentIndexBySubject = {};
  state.currentMistakeIndex = 0;
  saveState(state);
}

return { loadState, saveState, resetStudyState };
})();
