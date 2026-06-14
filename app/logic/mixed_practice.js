window.MixedPractice = (() => {
  const countOptions = [20, 30, 40, 50];

  function createSession(state, repository, subject, requestedCount) {
    state.mixedPractice ||= { active: null, history: [], usedBySubject: {} };
    state.mixedPractice.usedBySubject ||= {};

    const all = window.QuestionRepository.getQuestions(repository, { subject });
    const count = Math.min(Number(requestedCount) || countOptions[0], all.length);
    const used = new Set(state.mixedPractice.usedBySubject[subject] || []);
    const freshPool = shuffle(all.filter((question) => !used.has(question.id)));
    const selected = freshPool.slice(0, count);

    if (selected.length < count) {
      const selectedIds = new Set(selected.map((question) => question.id));
      const refill = shuffle(all.filter((question) => !selectedIds.has(question.id))).slice(0, count - selected.length);
      selected.push(...refill);
    }

    const selectedIds = selected.map((question) => question.id);
    const nextUsed = new Set(freshPool.length >= count ? [...used, ...selectedIds] : selectedIds);
    state.mixedPractice.usedBySubject[subject] = [...nextUsed];
    state.mixedPractice.active = {
      sessionId: createSessionId(subject),
      subject,
      requestedCount: count,
      questionIds: selectedIds,
      currentIndex: 0,
      answers: {},
      createdAt: new Date().toISOString(),
      completed: false,
      result: null
    };
    return state.mixedPractice.active;
  }

  function getActiveQuestions(state, repository) {
    const ids = state.mixedPractice?.active?.questionIds || [];
    return ids.map((id) => window.QuestionRepository.getById(repository, id)).filter(Boolean);
  }

  function score(session, repository) {
    const questions = (session.questionIds || []).map((id) => window.QuestionRepository.getById(repository, id)).filter(Boolean);
    const answers = session.answers || {};
    const details = questions.map((question, index) => {
      const answer = answers[question.id];
      const correct = Boolean(answer && answer.correct === true);
      const pending = Boolean(answer && (answer.unscored || answer.needsReview));
      return {
        index: index + 1,
        questionId: question.id,
        subject: question.subject,
        type: question.type,
        question: question.question,
        answered: Boolean(answer),
        correct,
        pending
      };
    });
    const answered = details.filter((item) => item.answered).length;
    const correct = details.filter((item) => item.correct).length;
    const pending = details.filter((item) => item.pending).length;
    const wrong = details.filter((item) => item.answered && !item.correct && !item.pending).length;
    return {
      sessionId: session.sessionId,
      subject: session.subject,
      total: questions.length,
      answered,
      correct,
      wrong,
      pending,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      completedAt: new Date().toISOString(),
      details
    };
  }

  function complete(state, repository) {
    const session = state.mixedPractice?.active;
    if (!session) return null;
    const result = score(session, repository);
    session.completed = true;
    session.result = result;
    state.mixedPractice.history = [result, ...(state.mixedPractice.history || [])].slice(0, 20);
    return result;
  }

  function shuffle(items) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function createSessionId(subject) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `MIX-${subject.slice(0, 2)}-${stamp}-${random}`;
  }

  return { countOptions, createSession, getActiveQuestions, complete, score };
})();
