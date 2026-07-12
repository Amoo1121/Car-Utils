# Car Utils

一个车辆生活账本 GUI 原型，支持本地账户、车辆绑定、加油统计和 DIY 洗车统计。

## 数据与同步

本机开发版使用 Docker 中的 SQLite 作为主要持久化存储：

- React 前端通过 `/api/store` 读写本地后端。
- SQLite 数据库位于 Docker volume `car-utils_car-utils-sqlite`。
- 浏览器 `localStorage` key `car-utils-store-v1` 继续保留为即时备份。
- 后端短暂不可用时，页面会降级使用浏览器备份，不会白屏。
- 后端恢复后，前端会通过版本检查和现有 merge 规则写回 SQLite。

登录后仍可在“同步”tab 导出 JSON 备份，也可以导入备份并与本机数据合并。

当前 Web 版已经加入 CloudBase 云同步 MVP：

- 云端使用单个同步文档保存加密后的账本数据。
- 电脑和手机填写同一个 CloudBase 环境 ID、集合名和同步密钥即可同步。
- 同步流程会先拉取云端数据、与本机数据合并，再回写云端，避免简单覆盖。
- JSON 导入/导出仍然保留，适合作为手动备份。

同步策略见 [docs/sync-strategy.md](docs/sync-strategy.md)。

手机访问和 CloudBase 同步的完整操作步骤见 [docs/iphone-cloudbase-guide.md](docs/iphone-cloudbase-guide.md)。

Docker + SQLite 的完整说明见 [docs/local-persistence.md](docs/local-persistence.md)。

## 运行

前置条件：Docker Desktop 必须已经启动。

```bash
npm install
npm run dev
```

`npm run dev` 会自动执行 `docker compose up -d --build --wait`，等待本地后端通过健康检查，然后运行 Vite。不需要再单独执行 Docker 命令。

Vite 固定使用 5173 端口。如果提示 `Port 5173 is already in use`，说明已有一个前端开发进程正在运行。请回到原终端停止旧进程，或关闭旧进程后重新执行 `npm run dev`。不要同时使用自动切换出的 5174 等端口，因为不同端口拥有相互隔离的浏览器 `localStorage`。

默认地址：

```text
http://localhost:5173/
```

日常请固定使用这个地址。`localhost`、`127.0.0.1` 和不同端口都属于不同的浏览器来源，彼此不能读取对方的 `localStorage` 备份。

后端地址：

```text
http://127.0.0.1:3001/
```

启动后可以验证：

```bash
docker compose ps
curl http://localhost:3001/api/health
```

正常结果应看到 `car-utils-server` 状态为 `healthy`，并返回：

```json
{"ok":true}
```

如果 SQLite 还没有 Store，但浏览器中有旧数据，打开前端页面后会自动从 `localStorage` 导入。验证是否已经写入 SQLite：

```bash
curl -i http://localhost:3001/api/store
```

返回 `HTTP 200` 和 Store JSON 表示持久化成功；返回 `404 {"store":null}` 表示尚未触发导入或当前浏览器没有旧数据。

只启动或修复后端：

```bash
npm run backend:up
```

停止后端：

```bash
npm run backend:stop
```

不要执行 `docker compose down -v`，`-v` 会删除 SQLite volume。

### 后端不可用提示

如果页面显示“本地后端不可用，当前使用浏览器备份”，依次检查：

```bash
docker compose ps -a
curl http://localhost:3001/api/health
npm run backend:up
```

如果健康检查正常但页面仍显示不可用，请确认浏览器打开的是 `http://localhost:5173/`，然后刷新页面。还可以在浏览器开发者工具 Console 中检查是否有 `/api/store` 请求错误。

容器配置了 `restart: unless-stopped` 和 healthcheck。Docker Desktop 重启后会自动恢复；手动执行过 `npm run backend:stop` 时，需要再次运行 `npm run backend:up`。

## 手机访问本机开发服务

让 Mac 和 iPhone 连接同一个 Wi-Fi，然后在 Mac 上运行：

```bash
npm run dev:lan
```

该命令也会自动启动 Docker 后端。

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

本机开发环境以 Docker SQLite 为主存储，浏览器 `localStorage` 为本地备份。CloudBase 静态托管页面无法直接访问你 Mac 上的 Docker 后端，因此出门使用时仍依赖浏览器备份与 CloudBase 同步。后续可以继续接入微信小程序登录、车型查询 API 和更细的云端权限规则。
