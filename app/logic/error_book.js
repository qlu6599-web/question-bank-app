window.ErrorBook = (() => {
  function recordAnswer(state, question, answerRecord) {
    state.answers[question.id] = answerRecord;
    if (!state.completedIds.includes(question.id)) state.completedIds.push(question.id);
    if (state.tempSelections) delete state.tempSelections[question.id];

    if (answerRecord.unscored) removeMistake(state, question.id);
    else if (answerRecord.needsReview || answerRecord.correct === false) addMistake(state, question.id);
    else if (answerRecord.correct) removeMistake(state, question.id);
  }

  function getMistakeQuestions(state, repository) {
    return state.mistakes.map((id) => window.QuestionRepository.getById(repository, id)).filter(Boolean);
  }

  function startReview(state, questionId) {
    state.wrongPractice ||= { questionId: null, answers: {} };
    state.wrongPractice.questionId = questionId;
    state.wrongPractice.subject = null;
    state.wrongPractice.questionIds = [questionId];
    state.wrongPractice.currentIndex = 0;
    delete state.wrongPractice.answers[questionId];
    if (state.tempSelections) delete state.tempSelections[`review:${questionId}`];
  }

  function startReviewSession(state, subject, questionIds, startQuestionId = null) {
    state.wrongPractice ||= { questionId: null, answers: {} };
    const ids = [...new Set(questionIds)].filter(Boolean);
    const startIndex = Math.max(0, ids.indexOf(startQuestionId));
    state.wrongPractice.subject = subject;
    state.wrongPractice.questionIds = ids;
    state.wrongPractice.currentIndex = startIndex;
    state.wrongPractice.questionId = ids[startIndex] || null;
    state.wrongPractice.answers = {};
    ids.forEach((id) => {
      if (state.tempSelections) delete state.tempSelections[`review:${id}`];
    });
  }

  function advanceReviewSession(state) {
    const session = state.wrongPractice;
    if (!session?.questionIds?.length) return false;
    const nextIndex = Math.min((session.currentIndex || 0) + 1, session.questionIds.length);
    if (nextIndex >= session.questionIds.length) return false;
    session.currentIndex = nextIndex;
    session.questionId = session.questionIds[nextIndex];
    return true;
  }

  function getReviewAnswer(state, questionId) {
    return state.wrongPractice?.answers?.[questionId] || null;
  }

  function recordReviewAnswer(state, question, answerRecord) {
    state.wrongPractice ||= { questionId: question.id, answers: {} };
    state.wrongPractice.answers[question.id] = answerRecord;
    if (state.tempSelections) delete state.tempSelections[`review:${question.id}`];
    recordAnswer(state, question, answerRecord);
  }

  function markReviewSubjective(state, question, correct) {
    const current = getReviewAnswer(state, question.id);
    if (!current) return;
    const answerRecord = window.QuizEngine.markSubjective(current, correct);
    state.wrongPractice.answers[question.id] = answerRecord;
    recordAnswer(state, question, answerRecord);
  }

  function addMistake(state, questionId) {
    if (!state.mistakes.includes(questionId)) state.mistakes.push(questionId);
  }

  function removeMistake(state, questionId) {
    state.mistakes = state.mistakes.filter((id) => id !== questionId);
  }

  return {
    recordAnswer,
    getMistakeQuestions,
    startReview,
    startReviewSession,
    advanceReviewSession,
    getReviewAnswer,
    recordReviewAnswer,
    markReviewSubjective
  };
})();
