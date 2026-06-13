# 智题库 - 刷题 App MVP

一个可直接运行、可扩展为商业产品的 Web/PWA 刷题 App。

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

iPhone 上完整 PWA 安装建议部署到 HTTPS 静态站点，例如 GitHub Pages、Vercel、Netlify 或 Cloudflare Pages。

部署后用 iPhone Safari 打开 HTTPS 地址，点击分享，选择“添加到主屏幕”。

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
