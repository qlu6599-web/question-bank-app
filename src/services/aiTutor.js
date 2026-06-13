window.AiTutorService = {
  async explainQuestion(question, userAnswer) {
    return {
      status: "placeholder",
      message: `AI 讲题接口已预留：题目 ${question.id}，用户选择 ${userAnswer || "未选择"}。后续可接入 OpenAI、私有知识库或教师解析。`
    };
  }
};
