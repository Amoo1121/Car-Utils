# Car Utils

一个车辆生活账本 GUI 原型，支持本地账户、车辆绑定、加油统计和 DIY 洗车统计。

## 数据与同步

网页端数据当前保存在浏览器 `localStorage`。登录后可以在“同步”tab 导出 JSON 备份，也可以导入备份并与本机数据合并。

后续微信小程序版本会复用同一份数据结构，先支持导入网页备份，再接入微信云开发做多端同步。同步策略见 [docs/sync-strategy.md](docs/sync-strategy.md)。

## 运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173/
```

## 构建

```bash
npm run build
```

构建产物在 `dist/`，可以部署到 GitHub Pages、Vercel、Netlify 或任意静态文件服务。

## iPhone / 移动端

当前 Web 版已经加入 PWA manifest 和基础离线缓存。部署到 HTTPS 地址后，可以在 iPhone Safari 打开页面，通过分享菜单“添加到主屏幕”，日常使用会更接近独立 App。

注意：云同步上线前，数据仍保存在当前浏览器本机。更换手机、清理浏览器数据或切换浏览器前，请先在“同步”页面导出 JSON 备份。

应用数据暂存在浏览器 `localStorage` 中，后续可以接入真实认证、数据库和车型查询 API。
