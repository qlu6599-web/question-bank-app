window.AiTutorService = {
  async explainQuestion(question, userAnswer) {
    return {
      status: "placeholder",
      message: `AI 讲题接口已预留：题目 ${question.id}，用户作答 ${Array.isArray(userAnswer) ? userAnswer.join("") : userAnswer || "未作答"}。后续可接入 OpenAI、私有知识库或教师解析。`
    };
  }
};
