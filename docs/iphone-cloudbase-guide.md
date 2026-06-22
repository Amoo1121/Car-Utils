# iPhone 使用与 CloudBase 同步指南

## 1. Web 版访问地址

项目已经部署到 CloudBase 静态网站托管。日常出门使用这个公网 HTTPS 地址：

访问地址：

```text
https://car-utils-sync-d8gc5l3xlb8350cdf-1446050640.tcloudbaseapp.com/
```

CloudBase 默认测试域名会显示一次“页面访问提示 / 风险提醒”，点击“确定访问”即可进入应用。

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
5. 当前免费套餐无法手动添加安全域名，因此不要使用 GitHub Pages 域名访问 CloudBase SDK。请使用 CloudBase 静态托管默认域名。

## 3. 电脑端首次同步

1. 打开 `https://car-utils-sync-d8gc5l3xlb8350cdf-1446050640.tcloudbaseapp.com/`。
2. 用你现有的名称和邮箱登录。
3. 进入左侧“同步”。
4. 填写 CloudBase：
   - 环境 ID：`car-utils-sync-d8gc5l3xlb8350cdf`
   - 地域：环境所在地域
   - 同步密钥：自己设置一段至少 8 位的私密口令
   - 集合名：`car_utils_sync`
   - Access Key：没有就留空，使用匿名登录
5. 点击“立即同步”。

首次同步会把电脑浏览器里的本地账本加密后上传到 CloudBase。

## 4. iPhone 使用

1. 用 iPhone Safari 打开：

```text
https://car-utils-sync-d8gc5l3xlb8350cdf-1446050640.tcloudbaseapp.com/
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

### 打开后先看到 CloudBase 风险提醒

这是默认测试域名的限制。等待倒计时结束，点击“确定访问”即可。

### 点击同步提示需要 HTTPS 或 localhost

你可能还在用 `http://192.168.x.x:5174` 这种局域网地址。出门同步请使用 CloudBase 静态托管 HTTPS 地址。

### 电脑和手机数据不一样

两边都点一次“立即同步”。同步逻辑会按记录 ID 和更新时间合并，不会直接清空另一端。
