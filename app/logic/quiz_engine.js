window.QuizEngine = (() => {
  function scopeKey(subject, type) {
    return `${subject}::${type}`;
  }

  function getCurrentIndex(state, subject, type, length) {
    const key = scopeKey(subject, type);
    const raw = state.indexByScope[key] || 0;
    return Math.min(raw, Math.max(length - 1, 0));
  }

  function goNext(state, subject, type, questionsOrLength) {
    const key = scopeKey(subject, type);
    const questions = Array.isArray(questionsOrLength) ? questionsOrLength : [];
    const length = Array.isArray(questionsOrLength) ? questionsOrLength.length : questionsOrLength;
    if (!length) {
      state.indexByScope[key] = 0;
      return;
    }
    if (state.mode === "random") {
      const currentIndex = getCurrentIndex(state, subject, type, length);
      const currentId = questions[currentIndex]?.id || null;
      const unanswered = questions.filter((question) => !state.answers[question.id]);
      const pool = (unanswered.length ? unanswered : questions).filter((question) => question.id !== currentId);
      const selected = pool.length ? pool[Math.floor(Math.random() * pool.length)] : questions[currentIndex];
      state.indexByScope[key] = Math.max(0, questions.findIndex((question) => question.id === selected.id));
      return;
    }
    const currentIndex = getCurrentIndex(state, subject, type, length);
    for (let step = 1; step <= length; step += 1) {
      const candidateIndex = (currentIndex + step) % length;
      const candidate = questions[candidateIndex];
      if (candidate && !state.answers[candidate.id]) {
        state.indexByScope[key] = candidateIndex;
        return;
      }
    }
    state.indexByScope[key] = (currentIndex + 1) % length;
  }

  function getMode(question) {
    if (question.type === "multiple") return "choice-multiple";
    if (["single", "judge"].includes(question.type)) return "choice-single";
    if (question.type === "fill") return "text";
    return "essay";
  }

  function isChoice(question) {
    return ["single", "multiple", "judge"].includes(question.type) && question.options.length >= 2;
  }

  function isSubjective(question) {
    return ["essay", "comprehensive"].includes(question.type);
  }

  function evaluate(question, selected) {
    const mode = getMode(question);
    if (mode === "essay") {
      return {
        selected: String(selected || "").trim(),
        status: "submitted",
        correct: false,
        needsReview: true,
        answeredAt: new Date().toISOString()
      };
    }

    if (mode === "text") {
      const expected = acceptedTextAnswers(question);
      const actual = normalizeTextAnswer(selected);
      const correct = expected.some((answer) => normalizeTextAnswer(answer) === actual);
      return {
        selected: String(selected || "").trim(),
        status: "submitted",
        correct,
        answeredAt: new Date().toISOString()
      };
    }

    const selectedLetters = normalizeLetters(selected);
    const correctLetters = normalizeLetters(question.answer);
    const unscored = question.unscored || correctLetters.length === 0;
    return {
      selected: selectedLetters,
      status: "submitted",
      correct: unscored ? null : selectedLetters.join("") === correctLetters.join(""),
      unscored,
      answeredAt: new Date().toISOString()
    };
  }

  function markSubjective(answerRecord, correct) {
    return {
      ...answerRecord,
      correct,
      needsReview: false,
      reviewedAt: new Date().toISOString()
    };
  }

  function acceptedTextAnswers(question) {
    if (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length) return question.acceptedAnswers;
    return [question.answer].filter(Boolean);
  }

  function normalizeLetters(value) {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim().toUpperCase()).filter(Boolean).sort();
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

  return {
    scopeKey,
    getCurrentIndex,
    goNext,
    getMode,
    isChoice,
    isSubjective,
    evaluate,
    markSubjective,
    normalizeLetters
  };
})();
