window.StatsEngine = (() => {
  function summarize(state, questions) {
    const scoredAnswers = Object.values(state.answers).filter((answer) => answer && !answer.unscored && !answer.needsReview);
    const correctCount = scoredAnswers.filter((answer) => answer.correct).length;
    const subjectStats = {};
    const typeStats = {};

    questions.forEach((question) => {
      subjectStats[question.subject] ||= createBucket();
      typeStats[question.type] ||= createBucket();
      updateBucket(subjectStats[question.subject], state.answers[question.id]);
      updateBucket(typeStats[question.type], state.answers[question.id]);
    });

    return {
      totalQuestions: questions.length,
      totalAnswered: Object.keys(state.answers).length,
      correctCount,
      wrongCount: state.mistakes.length,
      accuracy: scoredAnswers.length ? Math.round((correctCount / scoredAnswers.length) * 100) : 0,
      subjectStats,
      typeStats
    };
  }

  function createBucket() {
    return { total: 0, answered: 0, scored: 0, correct: 0 };
  }

  function updateBucket(bucket, answer) {
    bucket.total += 1;
    if (!answer) return;
    bucket.answered += 1;
    if (answer.unscored || answer.needsReview) return;
    bucket.scored += 1;
    if (answer.correct) bucket.correct += 1;
  }

  return { summarize };
})();
