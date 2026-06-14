window.AnalyticsService = {
  summarize(state, allQuestions) {
    const totalAnswered = Object.keys(state.answers).length;
    const scoredAnswers = Object.values(state.answers).filter((answer) => answer && !answer.unscored && !answer.needsReview);
    const correctCount = scoredAnswers.filter((answer) => answer.correct).length;
    const subjectStats = allQuestions.reduce((acc, question) => {
      acc[question.subject] ||= { total: 0, answered: 0, scored: 0, correct: 0 };
      acc[question.subject].total += 1;
      const answer = state.answers[question.id];
      if (answer) {
        acc[question.subject].answered += 1;
        if (!answer.unscored && !answer.needsReview) {
          acc[question.subject].scored += 1;
          if (answer.correct) acc[question.subject].correct += 1;
        }
      }
      return acc;
    }, {});

    return {
      totalQuestions: allQuestions.length,
      totalAnswered,
      correctCount,
      wrongCount: state.mistakes.length,
      accuracy: scoredAnswers.length ? Math.round((correctCount / scoredAnswers.length) * 100) : 0,
      subjectStats
    };
  }
};
