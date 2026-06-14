# 智题库 - 模块化刷题 App MVP

一个可真实使用、JSON 驱动、可扩展为商业产品的 Web/PWA 刷题系统。

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
  pages/
    home.js
    subject.js
    quiz.js
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

## 数据结构

题目统一由 `app/data/question_bank.json` 驱动。每道题至少包含：

```json
{
  "subject": "软件工程",
  "type": "single",
  "question": "题干",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "A",
  "analysis": "解析"
}
```

当前支持题型：

- `single`：单选题
- `multiple`：多选题
- `judge`：判断题
- `fill`：填空题
- `essay`：问答题
- `comprehensive`：综合题

## 题库说明

当前题库共 1470 道。首页只选择科目，进入科目后再选择题型；软件工程已按“单选题、多选题、判断题、填空题、综合题、问答题”拆成二级分类。

操作系统和软件工程复习资料中的部分选择题未提供答案表，App 会记录作答但不计入错题和正确率。

## 扩展新题型

1. 在 `app/config/app_config.js` 的 `types` 和 `typeOrder` 中添加新题型。
2. 在 `app/logic/quiz_engine.js` 中添加该题型的判题模式。
3. 在 `app/pages/quiz.js` 中添加对应输入 UI。
4. 在 `app/data/question_bank.json` 中加入对应 `type` 的题目。
5. 如果题库来自资料解析，更新 `scripts/build_question_bank.py` 的类型映射和生成逻辑。

## 预留模块

- AI 讲题：`app/services/ai_tutor.js`
- 云同步：`app/services/cloud_sync.js`
- 用户系统：`app/services/user_service.js`
- 数据分析：`app/logic/stats.js`
