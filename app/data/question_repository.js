window.QuestionRepository = (() => {
  let cache = null;

  async function load() {
    if (cache) return cache;
    const response = await fetch(`./app/data/question_bank.json?v=${window.AppConfig.VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error("题库 JSON 加载失败");
    const raw = await response.json();
    cache = normalizeBank(raw);
    return cache;
  }

  function normalizeBank(raw) {
    if (!Array.isArray(raw.ALL_QUESTIONS)) {
      throw new Error("题库缺少 ALL_QUESTIONS 单一真相源");
    }

    const subjectMap = new Map();
    (raw.subjects || []).forEach((subject) => {
      subjectMap.set(subject.name, {
        name: subject.name,
        accent: subject.accent || "#2563eb",
        description: subject.description || "",
        types: [],
        total: 0
      });
    });

    const questions = raw.ALL_QUESTIONS.map((question) => {
      const subject = subjectMap.get(question.subject) || {};
      return {
        id: question.id,
        subject: question.subject,
        type: normalizeType(question.type),
        question: question.question || "",
        options: Array.isArray(question.options) ? question.options : [],
        answer: question.answer || "",
        analysis: question.analysis || "",
        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
        referenceAnswer: question.referenceAnswer || "",
        questionImages: Array.isArray(question.questionImages) ? question.questionImages : [],
        referenceImages: Array.isArray(question.referenceImages) ? question.referenceImages : [],
        unscored: Boolean(question.unscored),
        originalType: question.originalType || question.type,
        source: question.source || question.subject,
        sourceFile: question.sourceFile || "",
        pageNumber: question.pageNumber ?? null,
        sourceNumber: question.sourceNumber ?? null,
        sourceTypeLabel: question.sourceTypeLabel || "",
        accent: question.accent || subject.accent || "#2563eb"
      };
    });

    const subjects = Array.from(subjectMap.values()).map((subject) => {
      const subjectQuestions = questions.filter((question) => question.subject === subject.name);
      const typeCounts = subjectQuestions.reduce((acc, question) => {
        acc[question.type] = (acc[question.type] || 0) + 1;
        return acc;
      }, {});
      return {
        ...subject,
        total: subjectQuestions.length,
        types: window.AppConfig.typeOrder
          .filter((type) => typeCounts[type])
          .map((type) => ({
            type,
            label: window.AppConfig.types[type]?.label || type,
            count: typeCounts[type]
          }))
      };
    });

    return {
      version: raw.version,
      singleSourceOfTruth: raw.singleSourceOfTruth || "ALL_QUESTIONS",
      subjects,
      ALL_QUESTIONS: questions,
      questions,
      byId: new Map(questions.map((question) => [question.id, question]))
    };
  }

  function normalizeType(type) {
    const map = {
      cloze: "fill",
      qa: "essay",
      design: "comprehensive",
      application: "comprehensive"
    };
    return map[type] || type;
  }

  function getSubjects(repository) {
    return repository.subjects;
  }

  function getSubject(repository, subjectName) {
    return repository.subjects.find((subject) => subject.name === subjectName) || null;
  }

  function getQuestions(repository, filters = {}) {
    return repository.ALL_QUESTIONS.filter((question) => {
      if (filters.subject && question.subject !== filters.subject) return false;
      if (filters.type && question.type !== filters.type) return false;
      return true;
    });
  }

  function getAllQuestions(repository) {
    return repository.ALL_QUESTIONS;
  }

  function getById(repository, questionId) {
    return repository.byId.get(questionId) || null;
  }

  function getTypesForSubject(repository, subjectName) {
    const subject = getSubject(repository, subjectName);
    if (!subject) return [];
    const order = subjectName === "软件工程" ? window.AppConfig.softwareTypeOrder : window.AppConfig.typeOrder;
    return [...subject.types].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  return { load, getSubjects, getSubject, getQuestions, getAllQuestions, getById, getTypesForSubject };
})();
