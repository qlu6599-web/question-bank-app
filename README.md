# 智题库 - 刷题 App MVP

一个可直接运行、可扩展为商业产品的 Web/PWA 刷题 App。

## 线上地址

GitHub Pages:

```text
https://qlu6599-web.github.io/question-bank-app/
```

## 本地运行

直接打开 `index.html` 即可运行。

推荐使用本地服务：

```powershell
python -m http.server 5173 --bind 0.0.0.0
```

电脑浏览器访问：

```text
http://127.0.0.1:5173
```

同一 Wi-Fi 下的手机访问：

```text
http://电脑局域网IP:5173
```

## PWA 安装

现在已经部署到 GitHub Pages，可直接用 iPhone Safari 打开线上地址。

安装步骤：

1. 用 iPhone Safari 打开 `https://qlu6599-web.github.io/question-bank-app/`
2. 点击底部分享按钮
3. 选择“添加到主屏幕”
4. 以后从主屏幕图标打开即可继续使用

## 题库说明

当前题库共 1218 道。操作系统科目已包含 100 道单选、42 道填空和 198 道判断。

操作系统复习资料中的单选题未提供答案表，因此 App 会记录选择并提示“原资料未提供答案”，不会把这些题计入错题或正确率。

## 主要结构

```text
index.html
manifest.webmanifest
sw.js
assets/
styles/
src/
  app.js
  data/
  services/
  store/
  utils/
```
