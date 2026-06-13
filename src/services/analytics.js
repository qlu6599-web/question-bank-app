window.AnalyticsService = {
  summarize(state, allQuestions) {
    const totalAnswered = Object.keys(state.answers).length;
    const correctCount = Object.values(state.answers).filter((answer) => answer.correct).length;
    const subjectStats = allQuestions.reduce((acc, question) => {
      acc[question.subject] ||= { total: 0, answered: 0, correct: 0 };
      acc[question.subject].total += 1;
      const answer = state.answers[question.id];
      if (answer) {
        acc[question.subject].answered += 1;
        if (answer.correct) acc[question.subject].correct += 1;
      }
      return acc;
    }, {});

    return {
      totalQuestions: allQuestions.length,
      totalAnswered,
      correctCount,
      wrongCount: state.mistakes.length,
      accuracy: totalAnswered ? Math.round((correctCount / totalAnswered) * 100) : 0,
      subjectStats
    };
  }
};
