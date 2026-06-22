# iPhone 使用与 CloudBase 同步指南

## 1. Web 版访问地址

项目已经配置 GitHub Pages 自动部署。每次推送到 `main` 后，GitHub Actions 会构建 `dist/` 并发布到 Pages。

默认访问地址：

```text
https://amoo1121.github.io/Car-Utils/
```

如果 GitHub Pages 因仓库是 private 或账号套餐限制无法启用，需要把仓库改为 public，或换成 Vercel / Netlify / Cloudflare Pages。

## 2. CloudBase 控制台准备

1. 打开腾讯云开发 / CloudBase 控制台。
2. 创建一个环境，记录：
   - 环境 ID
   - 地域，例如 `ap-shanghai`
3. 进入数据库，创建集合：

```text
car_utils_sync
```

4. 进入登录/认证设置，开启匿名登录；如果你不想用匿名登录，也可以在应用里填写 Web 可用的 Access Key。
5. 进入 Web 安全域名 / 安全来源配置，加入：

```text
https://amoo1121.github.io
```

本地调试时可以额外加入：

```text
http://localhost:5174
http://127.0.0.1:5174
```

局域网 IP 地址只适合临时开发，不适合出门使用。

## 3. 电脑端首次同步

1. 打开 `https://amoo1121.github.io/Car-Utils/`。
2. 用你现有的名称和邮箱登录。
3. 进入左侧“同步”。
4. 填写 CloudBase：
   - 环境 ID：CloudBase 环境 ID
   - 地域：环境所在地域
   - 同步密钥：自己设置一段至少 8 位的私密口令
   - 集合名：`car_utils_sync`
   - Access Key：没有就留空，使用匿名登录
5. 点击“立即同步”。

首次同步会把电脑浏览器里的本地账本加密后上传到 CloudBase。

## 4. iPhone 使用

1. 用 iPhone Safari 打开：

```text
https://amoo1121.github.io/Car-Utils/
```

2. 用同一个邮箱登录。
3. 进入“同步”，填写和电脑端完全相同的 CloudBase 配置。
4. 点击“立即同步”，把云端数据合并到手机浏览器。
5. Safari 分享菜单选择“添加到主屏幕”，以后可以像 App 一样打开。

## 5. 日常使用建议

- 出门前：电脑端点一次“立即同步”。
- 出门时：手机端记录加油/洗车。
- 回家后：手机端点一次“立即同步”，电脑端再点一次“立即同步”。
- 重要数据变多后，仍建议定期在“同步”页导出 JSON 备份。

## 6. 同步密钥注意事项

- 同步密钥用于定位云端文档，也用于加密账本数据。
- 电脑和手机必须使用同一个同步密钥。
- 忘记同步密钥后，旧的云端同步文档无法解密。
- 不要把同步密钥发给别人。

## 7. 常见问题

### 手机打开还是旧页面

在 Safari 里刷新页面；如果已经添加到主屏幕，可以先关闭后台里的 Car Utils，再重新打开。

### 点击同步提示安全域名错误

去 CloudBase 控制台把 `https://amoo1121.github.io` 加入 Web 安全域名。

### 点击同步提示需要 HTTPS 或 localhost

你可能还在用 `http://192.168.x.x:5174` 这种局域网地址。出门同步请使用 GitHub Pages 的 HTTPS 地址。

### 电脑和手机数据不一样

两边都点一次“立即同步”。同步逻辑会按记录 ID 和更新时间合并，不会直接清空另一端。
