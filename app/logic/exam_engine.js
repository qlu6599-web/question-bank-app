window.ExamEngine = (() => {
  function getRule(subject) {
    const rule = window.AppConfig.examRules[subject] || {
      ...window.AppConfig.defaultExamRule,
      name: `${subject}自动模拟卷`
    };
    return {
      ...rule,
      sections: rule.sections.map((section) => ({ ...section }))
    };
  }

  function preview(repository, subject) {
    const rule = getRule(subject);
    const available = {};
    const scored = {};
    window.QuestionRepository.getQuestions(repository, { subject }).forEach((question) => {
      available[question.type] = (available[question.type] || 0) + 1;
      if (!isPendingQuestion(question)) scored[question.type] = (scored[question.type] || 0) + 1;
    });
    return {
      rule,
      available,
      scored,
      totalQuestions: rule.sections.reduce((sum, section) => sum + Math.min(section.count, available[section.type] || 0), 0),
      totalScore: rule.sections.reduce((sum, section) => sum + Math.min(section.count, available[section.type] || 0) * section.score, 0),
      pendingScore: rule.sections.reduce((sum, section) => {
        const needed = Math.min(section.count, available[section.type] || 0);
        const scoredCount = Math.min(needed, scored[section.type] || 0);
        return sum + Math.max(needed - scoredCount, 0) * section.score;
      }, 0)
    };
  }

  function generate(repository, subject) {
    const rule = getRule(subject);
    const usedIds = new Set();
    const sections = [];
    const questions = [];

    rule.sections.forEach((section, sectionIndex) => {
      const pool = window.QuestionRepository.getQuestions(repository, { subject, type: section.type })
        .filter((question) => !usedIds.has(question.id));
      const selected = shuffle(pool).slice(0, section.count);
      const sectionQuestions = selected.map((question, index) => {
        usedIds.add(question.id);
        return {
          ...question,
          examScore: section.score,
          sectionType: section.type,
          sectionIndex,
          sectionQuestionNumber: index + 1,
          pendingReview: isPendingQuestion(question)
        };
      });
      sections.push({
        type: section.type,
        label: window.AppUI?.typeLabel ? window.AppUI.typeLabel(section.type) : section.type,
        requestedCount: section.count,
        count: sectionQuestions.length,
        score: section.score,
        totalScore: sectionQuestions.length * section.score
      });
      questions.push(...sectionQuestions);
    });

    return {
      examId: createExamId(subject),
      subject,
      title: rule.name,
      duration: rule.duration,
      totalScore: questions.reduce((sum, question) => sum + question.examScore, 0),
      expectedTotalScore: rule.totalScore,
      createdAt: new Date().toISOString(),
      sections,
      questions
    };
  }

  function createSession(exam) {
    const startedAt = Date.now();
    return {
      ...exam,
      startedAt,
      deadlineAt: startedAt + exam.duration * 60 * 1000,
      currentIndex: 0,
      answers: {},
      submitted: false
    };
  }

  function isPendingQuestion(question) {
    return Boolean(question.unscored || !String(question.answer || "").trim());
  }

  function createExamId(subject) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    const prefix = subject.split("").slice(0, 2).join("");
    return `EXAM-${prefix}-${stamp}-${random}`;
  }

  function shuffle(items) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  return { getRule, preview, generate, createSession, isPendingQuestion };
})();
