# Car Utils

一个车辆生活账本 Web 应用，支持密码账户、车辆绑定、加油统计和 DIY 洗车统计。

加油记录中的加油站输入支持历史名称建议和模糊匹配；建议会优先显示当前车辆常用、使用频率较高和最近使用的站点，同时仍允许直接输入新名称。

洗车耗材仓库内置常用药剂库，也支持根据用户填写的品牌和产品名称联网查找候选资料。候选图片、简介、容量和来源经用户确认后才会写入耗材，不会自动覆盖手动内容。

## 数据与同步

本机版使用 Docker 中的 SQLite 作为主要持久化存储：

- React 前端通过受认证保护的 `/api/store` 读写本地后端。
- 密码使用 scrypt 加盐哈希保存；浏览器会话使用 HttpOnly Cookie，SQLite 中只保存会话令牌的哈希。
- 每个认证账户拥有独立的 Store，不能读取其他账户的车辆账本。
- SQLite 数据库位于 Docker volume `car-utils_car-utils-sqlite`。
- 浏览器 `localStorage` key `car-utils-store-v1` 继续保留为即时备份。
- 后端短暂不可用时，页面会降级使用浏览器备份，不会白屏。
- 后端恢复后，前端会通过版本检查和现有 merge 规则写回 SQLite。

登录后仍可在“同步”tab 导出 JSON 备份，也可以导入备份并与当前账户数据合并。导入和 CloudBase 合并不会把其他本地账户的数据写进当前认证账户。

当前 Web 版已经加入 CloudBase 云同步 MVP：

- 云端使用单个同步文档保存加密后的账本数据。
- 电脑和手机填写同一个 CloudBase 环境 ID、集合名和同步密钥即可同步。
- 同步流程会先拉取云端数据、与本机数据合并，再回写云端，避免简单覆盖。
- JSON 导入/导出仍然保留，适合作为手动备份。

同步策略见 [docs/sync-strategy.md](docs/sync-strategy.md)。

手机访问和 CloudBase 同步的完整操作步骤见 [docs/iphone-cloudbase-guide.md](docs/iphone-cloudbase-guide.md)。

Docker + SQLite 的完整说明见 [docs/local-persistence.md](docs/local-persistence.md)。

已确认的响应式前端视觉稿和实现规范见 [docs/design/design-system.md](docs/design/design-system.md)。

## 日常启动（推荐）

Finder 打开项目目录，双击：

```text
start-car-utils.command
```

脚本会自动完成以下工作：

1. 检查 Docker Desktop；未启动时自动打开并等待就绪。
2. 构建并启动后台 Web 容器与 SQLite 后端容器。
3. 等待两个容器通过健康检查。
4. 打开 `http://localhost:4173/`。

看到页面后可以直接关闭 Terminal 和 PyCharm，Car Utils 会继续在 Docker Desktop 中后台运行。第一次构建需要下载镜像和安装依赖，时间会稍长；之后再次双击通常很快。

也可以在任意终端执行同样的后台启动命令：

```bash
npm run app:up
```

查看状态或日志：

```bash
npm run app:status
npm run app:logs
```

需要停止时，双击 `stop-car-utils.command`，或者执行：

```bash
npm run app:stop
```

停止不会删除 SQLite 数据或 Docker volume。不要执行 `docker compose down -v`。

如果希望 Mac 重启后也自动恢复，请在 Docker Desktop 设置中启用“登录时启动 Docker Desktop”。两个 Car Utils 容器均设置了 `restart: unless-stopped`，Docker 启动后会自动恢复；如果你曾主动执行停止脚本，则需要再次双击启动脚本。

完整说明见 [docs/background-operation.md](docs/background-operation.md)。

## 开发模式

前置条件：Docker Desktop 必须已经启动。

```bash
npm install
npm run dev
```

`npm run dev` 会自动执行 `docker compose up -d --build --wait`，等待本地后端通过健康检查，然后运行 Vite。不需要再单独执行 Docker 命令。

开发模式中的 Vite 必须依赖当前终端，适合改代码，不适合日常常驻使用。日常使用请打开 `http://localhost:4173/`，不要运行 `npm run dev`。

首次打开时选择“注册”。如果你在无密码版本中已经记录过数据，请使用当时完全相同的邮箱注册；系统会忽略邮箱大小写和首尾空格，并自动认领该邮箱名下的车辆、加油、洗车、耗材和费用记录。旧数据仍会保留在原备份中，不会因认领而被硬删除。

Vite 默认使用 5173 端口，也可以通过 `.env` 中的 `CAR_UTILS_WEB_PORT` 修改。如果提示端口已经占用，说明已有一个前端开发进程正在运行。请回到原终端停止旧进程，或关闭旧进程后重新执行 `npm run dev`。不要临时切换到其他端口，因为不同端口拥有相互隔离的浏览器 `localStorage`。

默认地址：

```text
http://localhost:5173/
```

日常请固定使用这个地址。`localhost`、`127.0.0.1` 和不同端口都属于不同的浏览器来源，彼此不能读取对方的 `localStorage` 备份。

### 自定义端口

复制环境变量示例，然后修改需要的端口：

```bash
cp .env.example .env
```

```env
CAR_UTILS_WEB_PORT=5180
CAR_UTILS_APP_PORT=4174
CAR_UTILS_API_PORT=3101
CAR_UTILS_API_INTERNAL_PORT=3001
```

重新执行 `npm run dev` 后，开发前端会使用 `http://localhost:5180/`，Docker 后端会暴露在 `http://localhost:3101/`，Vite 的 `/api` 代理也会自动指向新端口。再次运行后台启动脚本后，常驻版会使用 `http://localhost:4174/`。修改端口后请固定使用新地址，避免把浏览器备份分散到多个来源。

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

认证接口验证：

```bash
curl -i http://localhost:3001/api/auth/session
```

未登录时应返回 `HTTP 401` 和 `AUTH_REQUIRED`。这表示认证路由存在且正常；如果返回 `Route GET:/api/auth/session not found`，说明 Docker 仍在运行旧镜像，请执行：

```bash
docker compose up -d --build --force-recreate --wait
```

`GET /api/store` 现在也必须登录，直接用匿名 curl 会返回 `401`，不能再用匿名请求判断 Store 是否存在。登录页面后可通过页面顶部的数据状态和刷新按钮确认 SQLite 保存状态。

如果 SQLite 中保留着无密码版本的整包 Store，首次用旧邮箱注册并请求 Store 时，后端会按邮箱自动认领。若数据还只存在当前浏览器的 `localStorage`，前端也会在注册后提取同邮箱数据并上传到该账户的 SQLite Store。

验证耗材联网查找：

```bash
curl "http://localhost:3001/api/product-lookup?query=KLCB%20A14"
```

该接口通过公开网页搜索产品候选并读取页面公开的 Open Graph / JSON-LD 元数据，不需要额外 API Key。它属于尽力而为功能：结果可能不完整或来自经销商页面，因此前端始终要求用户确认候选后再应用。查询时只发送输入的品牌和产品名称，不发送车辆、账户、洗车记录或同步密钥。

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
curl -i http://localhost:3001/api/auth/session
```

如果健康检查正常但页面仍显示不可用，请确认浏览器打开的是 `http://localhost:5173/`，然后刷新页面。还可以在浏览器开发者工具 Console 中检查是否有 `/api/store` 请求错误。

容器配置了 `restart: unless-stopped` 和 healthcheck。Docker Desktop 重启后会自动恢复；手动执行过 `npm run backend:stop` 时，需要再次运行 `npm run backend:up`。

如果注册时提示 `Route POST:/api/auth/register not found`，不是邮箱问题，而是后端容器版本落后。执行下面的命令重建容器，然后刷新登录页：

```bash
docker compose up -d --build --force-recreate --wait
curl -i http://localhost:3001/api/auth/session
```

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

本机开发环境以 Docker SQLite 为主存储，浏览器 `localStorage` 为本地备份。当前密码鉴权服务也运行在本机 Docker 中；CloudBase 静态托管页面无法直接访问你 Mac 上的认证与 SQLite 后端。要在外网使用同一套账户，下一步需要把后端部署到公网 HTTPS 服务，再将 `VITE_CAR_UTILS_API_BASE_URL` 指向该服务。
