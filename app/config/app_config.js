window.AppConfig = (() => {
  const VERSION = "20260614-v10";

  const tabs = [
    { key: "home", label: "首页", icon: "⌂" },
    { key: "practice", label: "刷题", icon: "◇" },
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

  return { VERSION, tabs, typeOrder, types, softwareTypeOrder };
})();
