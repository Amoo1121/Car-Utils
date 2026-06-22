# Car Utils

一个车辆生活账本 GUI 原型，支持本地账户、车辆绑定、加油统计和 DIY 洗车统计。

## 数据与同步

网页端数据会先保存在浏览器 `localStorage`。登录后可以在“同步”tab 导出 JSON 备份，也可以导入备份并与本机数据合并。

当前 Web 版已经加入 CloudBase 云同步 MVP：

- 云端使用单个同步文档保存加密后的账本数据。
- 电脑和手机填写同一个 CloudBase 环境 ID、集合名和同步密钥即可同步。
- 同步流程会先拉取云端数据、与本机数据合并，再回写云端，避免简单覆盖。
- JSON 导入/导出仍然保留，适合作为手动备份。

同步策略见 [docs/sync-strategy.md](docs/sync-strategy.md)。

手机访问和 CloudBase 同步的完整操作步骤见 [docs/iphone-cloudbase-guide.md](docs/iphone-cloudbase-guide.md)。

## 运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173/
```

## 手机访问本机开发服务

让 Mac 和 iPhone 连接同一个 Wi-Fi，然后在 Mac 上运行：

```bash
npm run dev:lan
```

终端会输出类似下面的地址：

```text
Network: http://192.168.x.x:5173/
```

在 iPhone Safari 打开这个 `Network` 地址即可访问本机服务。如果 macOS 弹出防火墙提示，需要允许 Node.js 接受局域网连接。

这个方式只适合开发调试。同一 Wi-Fi 以外无法访问你的本机局域网地址；出门使用请先把构建产物部署到公网 HTTPS 域名。

## CloudBase 云同步配置

1. 在腾讯云开发 / CloudBase 控制台创建环境，记下环境 ID 和地域。
2. 在数据库中创建集合，默认集合名为 `car_utils_sync`。
3. 为 Web SDK 配置安全域名：本地调试可加入 `localhost` / `127.0.0.1` 对应端口；手机出门使用时，需要加入部署后的 HTTPS 域名。
4. 开启匿名登录，或在“同步”页面填写可用于 Web 访问的 Access Key。
5. 在 Car Utils 的“数据同步”页填写环境 ID、地域、集合名和同步密钥，点击“立即同步”。

同步密钥用于定位云端文档并加密账本数据。电脑和手机必须使用同一个同步密钥；忘记密钥后无法解密旧的云端同步文档。

## 构建

```bash
npm run build
```

构建产物在 `dist/`。当前项目已部署到 CloudBase 静态网站托管。

## 自动部署

当前可用的线上地址：

```text
https://car-utils-sync-d8gc5l3xlb8350cdf-1446050640.tcloudbaseapp.com/
```

重新部署到 CloudBase：

```bash
npm run build
npx --yes -p @cloudbase/cli tcb hosting deploy dist -e car-utils-sync-d8gc5l3xlb8350cdf
```

## iPhone / 移动端

当前 Web 版已经加入 PWA manifest 和基础离线缓存。部署到 HTTPS 地址后，可以在 iPhone Safari 打开页面，通过分享菜单“添加到主屏幕”，日常使用会更接近独立 App。

注意：出门同步请使用 CloudBase 静态托管 HTTPS 地址。更换手机、清理浏览器数据或切换浏览器前，建议仍定期在“同步”页面导出 JSON 备份。

应用仍以浏览器 `localStorage` 作为本地优先缓存，CloudBase 是可选同步层。后续可以继续接入微信小程序登录、车型查询 API 和更细的云端权限规则。
