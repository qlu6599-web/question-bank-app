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
    delete state.wrongPractice.answers[questionId];
    if (state.tempSelections) delete state.tempSelections[`review:${questionId}`];
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
    getReviewAnswer,
    recordReviewAnswer,
    markReviewSubjective
  };
})();
