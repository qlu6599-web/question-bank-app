window.AppConfig = (() => {
  const VERSION = "20260614-v18";

  const tabs = [
    { key: "home", label: "首页", icon: "⌂" },
    { key: "practice", label: "刷题", icon: "◇" },
    { key: "exam", label: "考试", icon: "▣" },
    { key: "wrongBook", label: "错题本", icon: "✕" },
    { key: "stats", label: "统计", icon: "◷" },
    { key: "profile", label: "我的", icon: "○" }
  ];

  const typeOrder = ["single", "multiple", "judge", "fill", "comprehensive", "essay"];

  const types = {
    single: {
      label: "单选题",
      shortLabel: "单选",
      mode: "choice-single",
      submitText: "提交答案"
    },
    multiple: {
      label: "多选题",
      shortLabel: "多选",
      mode: "choice-multiple",
      submitText: "提交答案"
    },
    judge: {
      label: "判断题",
      shortLabel: "判断",
      mode: "choice-single",
      submitText: "提交答案"
    },
    fill: {
      label: "填空题",
      shortLabel: "填空",
      mode: "text",
      submitText: "提交答案"
    },
    comprehensive: {
      label: "综合题",
      shortLabel: "综合",
      mode: "essay",
      submitText: "提交并查看解析"
    },
    essay: {
      label: "问答题",
      shortLabel: "问答",
      mode: "essay",
      submitText: "提交并查看解析"
    }
  };

  const softwareTypeOrder = ["single", "multiple", "judge", "fill", "comprehensive", "essay"];

  const examRules = {
    "软件工程": {
      name: "软件工程期末模拟卷",
      duration: 90,
      totalScore: 100,
      sections: [
        { type: "judge", count: 10, score: 1 },
        { type: "single", count: 10, score: 2 },
        { type: "multiple", count: 10, score: 3 },
        { type: "fill", count: 10, score: 2 },
        { type: "comprehensive", count: 1, score: 10 },
        { type: "essay", count: 1, score: 10 }
      ]
    },
    "数据库": {
      name: "数据库原理及应用机考模拟卷",
      duration: 90,
      totalScore: 100,
      sections: [
        { type: "single", count: 20, score: 2 },
        { type: "judge", count: 20, score: 1 },
        { type: "comprehensive", count: 4, score: 10 }
      ]
    },
    "操作系统": {
      name: "操作系统自动生成模拟卷",
      duration: 90,
      totalScore: 100,
      sections: [
        { type: "judge", count: 40, score: 1 },
        { type: "fill", count: 20, score: 3 }
      ]
    },
    "数据科学": {
      name: "数据科学标准模拟卷",
      duration: 90,
      totalScore: 100,
      sections: [
        { type: "single", count: 30, score: 1 },
        { type: "judge", count: 30, score: 1 },
        { type: "fill", count: 20, score: 2 }
      ]
    },
    "人工智能": {
      name: "人工智能导论标准模拟卷",
      duration: 90,
      totalScore: 100,
      sections: [
        { type: "single", count: 35, score: 1 },
        { type: "multiple", count: 15, score: 2 },
        { type: "judge", count: 25, score: 1 },
        { type: "fill", count: 2, score: 5 }
      ]
    }
  };

  const defaultExamRule = {
    duration: 90,
    totalScore: 100,
    sections: [
      { type: "single", count: 20, score: 2 },
      { type: "multiple", count: 10, score: 2 },
      { type: "judge", count: 20, score: 1 },
      { type: "essay", count: 1, score: 20 }
    ]
  };

  return { VERSION, tabs, typeOrder, types, softwareTypeOrder, examRules, defaultExamRule };
})();
