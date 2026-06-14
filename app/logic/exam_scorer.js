window.ExamScorer = (() => {
  function scoreExam(exam, answers) {
    const details = exam.questions.map((question, index) => scoreQuestion(question, answers[question.id], index));
    const typeScores = details.reduce((acc, item) => {
      acc[item.type] ||= { earned: 0, total: 0, pending: 0, correct: 0, count: 0 };
      acc[item.type].earned += item.earned;
      acc[item.type].total += item.maxScore;
      acc[item.type].pending += item.pending ? item.maxScore : 0;
      acc[item.type].correct += item.correct ? 1 : 0;
      acc[item.type].count += 1;
      return acc;
    }, {});
    const earnedScore = roundScore(details.reduce((sum, item) => sum + item.earned, 0));
    const pendingScore = details.reduce((sum, item) => sum + (item.pending ? item.maxScore : 0), 0);
    const wrongQuestions = details.filter((item) => !item.correct && !item.pending).map((item) => item.questionId);
    const pendingQuestions = details.filter((item) => item.pending).map((item) => item.questionId);
    const answeredCount = exam.questions.filter((question) => hasAnswer(answers[question.id])).length;
    const scoredCount = details.filter((item) => !item.pending).length;
    const correctCount = details.filter((item) => item.correct).length;

    return {
      examId: exam.examId,
      subject: exam.subject,
      title: exam.title,
      score: earnedScore,
      totalScore: exam.totalScore,
      pendingScore,
      correctRate: scoredCount ? Math.round((correctCount / scoredCount) * 100) : 0,
      answeredCount,
      questionCount: exam.questions.length,
      submittedAt: new Date().toISOString(),
      typeScores,
      details,
      wrongQuestions,
      pendingQuestions,
      analysis: buildAnalysis(typeScores, wrongQuestions, pendingQuestions),
      recommendations: buildRecommendations(typeScores, pendingQuestions),
      weakAreas: buildWeakAreas(typeScores, pendingQuestions)
    };
  }

  function scoreQuestion(question, rawAnswer, index) {
    const maxScore = Number(question.examScore || question.score || 0);
    const pending = window.ExamEngine.isPendingQuestion(question);
    const selected = normalizeAnswerByType(question, rawAnswer);
    if (pending) {
      return baseDetail(question, index, selected, maxScore, 0, false, true, "原资料未提供标准答案，需人工核对。");
    }
    if (!hasAnswer(selected)) {
      return baseDetail(question, index, selected, maxScore, 0, false, false, "未作答。");
    }

    if (["single", "multiple", "judge"].includes(question.type)) {
      const selectedLetters = normalizeLetters(selected);
      const correctLetters = normalizeLetters(question.answer);
      const correct = selectedLetters.join("") === correctLetters.join("");
      return baseDetail(question, index, selectedLetters, maxScore, correct ? maxScore : 0, correct, false, correct ? "选择正确。" : "选择错误。");
    }

    if (question.type === "fill") {
      const acceptedAnswers = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
        ? question.acceptedAnswers
        : [question.answer];
      const correct = acceptedAnswers.some((answer) => fuzzyTextMatch(selected, answer));
      return baseDetail(question, index, selected, maxScore, correct ? maxScore : 0, correct, false, correct ? "填空匹配。" : "填空答案未匹配。");
    }

    const keywordResult = keywordScore(question, selected);
    const earned = roundScore(maxScore * keywordResult.ratio);
    const correct = earned >= maxScore * 0.6;
    return baseDetail(
      question,
      index,
      selected,
      maxScore,
      earned,
      correct,
      false,
      keywordResult.keywords.length
        ? `关键词命中 ${keywordResult.matched.length}/${keywordResult.keywords.length}。`
        : "缺少可用关键词，按答案文本相似度给分。"
    );
  }

  function baseDetail(question, index, selected, maxScore, earned, correct, pending, note) {
    return {
      index: index + 1,
      questionId: question.id,
      subject: question.subject,
      type: question.type,
      question: question.question,
      selected,
      answer: question.answer,
      analysis: question.analysis,
      maxScore,
      earned: roundScore(earned),
      correct,
      pending,
      note
    };
  }

  function normalizeAnswerByType(question, answer) {
    if (["single", "multiple", "judge"].includes(question.type)) return normalizeLetters(answer);
    return String(answer || "").trim();
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

  function fuzzyTextMatch(actual, expected) {
    const left = normalizeText(actual);
    const right = normalizeText(expected);
    if (!left || !right) return false;
    if (left === right) return true;
    if (left.length >= 2 && right.includes(left)) return true;
    if (right.length >= 2 && left.includes(right)) return true;
    return Math.abs(left.length - right.length) <= 1 && levenshtein(left, right) <= 1;
  }

  function keywordScore(question, answer) {
    const source = `${question.keywords?.join(" ") || ""} ${question.referenceAnswer || ""} ${question.analysis || ""} ${question.answer || ""}`;
    const keywords = extractKeywords(source);
    const normalizedAnswer = normalizeText(answer);
    if (!normalizedAnswer) return { ratio: 0, keywords, matched: [] };
    if (!keywords.length) {
      const reference = normalizeText(question.answer || question.analysis || "");
      return { ratio: reference && normalizedAnswer.includes(reference.slice(0, 6)) ? 0.6 : 0.3, keywords, matched: [] };
    }
    const matched = keywords.filter((keyword) => normalizedAnswer.includes(normalizeText(keyword)));
    return {
      ratio: Math.min(1, matched.length / Math.max(keywords.length, 1)),
      keywords,
      matched
    };
  }

  function extractKeywords(text) {
    const stop = new Set(["参考答案", "本题", "答案", "包括", "可以", "进行", "应该", "以及", "一个", "如果", "系统"]);
    const parts = String(text || "")
      .replace(/[A-Za-z0-9_]+/g, (match) => ` ${match} `)
      .split(/[\s，。；;、：:（）()《》<>【】\[\]{}“”"'.,!?！？\n\r]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && !stop.has(item));
    return [...new Set(parts)].slice(0, 10);
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[，。,.、；;：:（）()《》<>【】\[\]{}“”"']/g, "")
      .toLowerCase();
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  }

  function hasAnswer(answer) {
    return Array.isArray(answer) ? answer.length > 0 : String(answer || "").trim().length > 0;
  }

  function roundScore(value) {
    return Math.round(value * 10) / 10;
  }

  function buildAnalysis(typeScores, wrongQuestions, pendingQuestions) {
    const weak = buildWeakAreas(typeScores, pendingQuestions);
    if (!wrongQuestions.length && !pendingQuestions.length) return "本次模拟考试表现稳定，自动评分题目没有明显失分。";
    return `本次共有 ${wrongQuestions.length} 道自动评分错题，${pendingQuestions.length} 道待核对题。薄弱环节：${weak.join("、") || "暂无明显薄弱题型"}。`;
  }

  function buildWeakAreas(typeScores, pendingQuestions) {
    const weak = Object.entries(typeScores)
      .filter(([, item]) => item.total - item.pending > 0)
      .map(([type, item]) => {
        const scoredTotal = item.total - item.pending;
        const rate = scoredTotal ? item.earned / scoredTotal : 1;
        return { type, rate };
      })
      .filter((item) => item.rate < 0.7)
      .sort((a, b) => a.rate - b.rate)
      .map((item) => window.AppUI?.typeLabel ? window.AppUI.typeLabel(item.type) : item.type);
    if (pendingQuestions.length) weak.push("待核对题");
    return weak;
  }

  function buildRecommendations(typeScores, pendingQuestions) {
    const weak = buildWeakAreas(typeScores, pendingQuestions);
    if (!weak.length) return ["保持整卷模拟节奏，下一步可以提高做题速度。"];
    return weak.map((area) => `${area}建议回到错题本重做，并复习对应章节的定义、规则和典型题。`);
  }

  return { scoreExam, scoreQuestion, fuzzyTextMatch };
})();
