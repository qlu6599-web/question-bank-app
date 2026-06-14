# 智题库 - 模块化刷题 + 模拟考试系统

一个可真实使用、JSON 驱动、可扩展为商业产品的 Web/PWA 学习系统。当前包含刷题系统和多学科模拟考试系统。

## 线上地址

```text
https://qlu6599-web.github.io/question-bank-app/
```

手机缓存刷新页：

```text
https://qlu6599-web.github.io/question-bank-app/refresh.html
```

## 本地运行

推荐用本地服务运行，因为题库通过 `question_bank.json` 加载：

```powershell
python -m http.server 5173 --bind 0.0.0.0
```

电脑访问：

```text
http://127.0.0.1:5173
```

同一 Wi-Fi 下手机访问：

```text
http://电脑局域网IP:5173
```

## PWA 安装

1. 用 iPhone Safari 打开线上地址
2. 点击分享按钮
3. 选择“添加到主屏幕”
4. 后续从主屏幕图标打开即可继续使用

## 模块结构

```text
index.html
manifest.webmanifest
sw.js
styles/
  app.css
app/
  config/
    app_config.js
  components/
    ui.js
  data/
    question_bank.json
    question_repository.js
  logic/
    quiz_engine.js
    error_book.js
    stats.js
    exam_engine.js
    exam_scorer.js
  pages/
    home.js
    subject.js
    quiz.js
    exam.js
    wrongBook.js
    stats.js
    profile.js
  services/
    ai_tutor.js
    cloud_sync.js
    user_service.js
  store/
    app_store.js
  main.js
scripts/
  build_question_bank.py
```

## 题库结构

题目统一由 `app/data/question_bank.json` 中的 `ALL_QUESTIONS` 驱动。`subjects` 只保存科目元数据，不保存分类数量；首页、刷题、考试、统计都从 `ALL_QUESTIONS` 动态 `filter` 得到视图。

```json
{
  "version": "20260614-v16",
  "schema": "question-bank-json-v2-single-source",
  "singleSourceOfTruth": "ALL_QUESTIONS",
  "subjects": [
    {
      "name": "软件工程",
      "accent": "#7c3aed",
      "description": "需求、设计、测试、维护与项目管理"
    }
  ],
  "ALL_QUESTIONS": [
    {
      "id": "se-1",
      "subject": "软件工程",
      "type": "single",
      "question": "题干",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "A",
      "sourceFile": "C:/Users/17920/Desktop/t题库/软件工程  复习资料.docx",
      "pageNumber": null,
      "analysis": "解析"
    }
  ]
}
```

当前支持题型：

- `single`：单选题
- `multiple`：多选题
- `judge`：判断题
- `fill`：填空题
- `essay`：问答题
- `comprehensive`：综合题

## 数据审计结果

已新增全量审计脚本：

```text
scripts/audit_question_bank.py
```

审计脚本会从 `C:\Users\17920\Desktop\t题库` 重新读取原始 `docx/pdf`，不使用 `extracted/` 缓存。输出文件：

```text
audit/source_text_fresh/
audit/question_bank_raw_before_dedupe.json
audit/question_bank_full_merged.json
audit/source_of_truth_report.json
audit/source_of_truth_report.md
audit/number_reconciliation_report.json
audit/number_reconciliation_report.md
audit/question_type_statistics.json
audit/audit_report.json
audit/missing_fix_report.md
app/data/question_bank_standard.json
app/data/question_bank.json
```

当前标准题库版本为 `20260614-v16`。原始重新解析共 1470 道，标准题库保留 1470 道；其中 8 组完全重复题只标记、不删除。人工智能导论 PDF 中 5 道公式选项题已生成题目截图并修复残缺选项。

## 模拟考试系统

入口在底部 Tab 的“考试”。系统按课程自动组卷，每次随机抽题，不重复题目，并生成独立 `examId`。

试卷结构示例：

```json
{
  "examId": "EXAM-软件-20260614120000-ABCDE",
  "subject": "软件工程",
  "totalScore": 100,
  "duration": 90,
  "questions": []
}
```

成绩结构：

```json
{
  "examId": "EXAM-软件-20260614120000-ABCDE",
  "score": 85,
  "wrongQuestions": [],
  "analysis": "本次模拟考试表现..."
}
```

## 组卷算法

1. `exam_engine.js` 读取 `AppConfig.examRules` 中的课程考试结构。
2. 从 `question_repository.js` 按 `subject + type` 取题。
3. 使用 Fisher-Yates shuffle 随机洗牌。
4. 按题型数量截取题目，并用 `Set` 保证同一张试卷不重复。
5. 为每题写入 `examScore`、题型分组、题号和待核对标记。
6. 生成包含 `examId`、`duration=90`、`totalScore`、`questions` 的试卷对象。

## 评分系统

评分逻辑在 `app/logic/exam_scorer.js`：

- 单选题：选项字母完全匹配得分。
- 多选题：全部选对才得分。
- 判断题：按 A/B 标准答案自动判分。
- 填空题：去空格、标点、大小写后模糊匹配；短答案允许包含匹配和轻微编辑距离。
- 问答题/综合题：从参考答案、解析、keywords 中提取关键词，按命中比例给分。
- 原资料没有标准答案的题：标记为“待核对”，不伪造答案。

提交后会生成成绩报告：

- 总分
- 各题型得分
- 正确率
- 错题列表
- 待核对题
- 薄弱分析
- 推荐复习内容

## 当前考试结构

- 软件工程：判断10、单选10、多选10、填空10、综合1、问答1，共100分。
- 数据库原理及应用：单选20、判断20、综合4，共100分。
- 操作系统：判断40、填空20，共100分。
- 数据科学：单选30、判断30、填空20，共100分。
- 人工智能导论：单选35、多选15、判断25、填空2，共100分。

说明：操作系统和软件工程复习资料中的部分选择题未提供答案表，考试系统会正常抽题，但提交后标为待核对，不会伪造自动评分。

## 错题回炉

考试提交后，自动评分错误的题会进入错题本。错题本不会直接显示答案，必须重新作答后才显示解析。

## 扩展新考试结构

在 `app/config/app_config.js` 中新增或修改：

```js
examRules["新课程"] = {
  name: "新课程模拟卷",
  duration: 90,
  totalScore: 100,
  sections: [
    { type: "single", count: 20, score: 2 },
    { type: "multiple", count: 10, score: 3 }
  ]
};
```

## 预留模块

- AI 自动讲解错题：`app/services/ai_tutor.js`
- 云同步：`app/services/cloud_sync.js`
- 用户系统：`app/services/user_service.js`
- 学习路径与数据分析：`app/logic/stats.js`
- 重点预测卷：可在 `exam_engine.js` 增加按知识点/难度抽题策略
