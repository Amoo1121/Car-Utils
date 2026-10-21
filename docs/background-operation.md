# 后台运行与启动方式

Car Utils 2.0 以一个原生 Node 进程运行：同一个 Fastify 服务同时提供页面、API 和 SQLite 存储，由 macOS 的 launchd 托管。不再需要 Docker Desktop、Terminal 或 IDE 常驻。

## 组成

| 项目 | 位置 |
| --- | --- |
| 后台服务 | `~/Library/LaunchAgents/com.carutils.server.plist`（登录自启、崩溃自动重启） |
| App 图标 | `~/Applications/Car Utils.app`（Launchpad / Spotlight 可搜到） |
| 数据库 | `~/Library/Application Support/Car Utils/car-utils.sqlite` |
| 自动备份 | `~/Library/Application Support/Car Utils/backups/`（每天一份，保留 30 份） |
| 日志 | `~/Library/Logs/Car Utils/server.log` |
| 访问地址 | `http://localhost:4173/`（端口可用 `.env` 的 `CAR_UTILS_APP_PORT` 修改） |

## 安装

```bash
npm run setup
```

或在 Finder 里双击 `start-car-utils.command`。安装过程：

1. 安装依赖并构建前端、后端。
2. 停止旧版 Docker 容器并关闭其自动重启（容器和数据卷都保留）。
3. 若本机还没有数据库，从 Docker 数据卷 `car-utils_car-utils-sqlite` 只读复制一份，校验完整性后启用。
4. 写入 launchd 服务并等待健康检查通过。
5. 生成 `Car Utils.app` 并打开。

打开 App 时会优先使用 Chrome / Edge / Brave 的独立窗口模式（无标签栏、像原生 App）；都没有安装时使用默认浏览器。想始终用默认浏览器，在 `.env` 里设置 `CAR_UTILS_BROWSER=default`。

## 日常命令

```bash
npm run car -- status     # 运行状态、数据位置
npm run car -- restart    # 拉取新代码后：npm run app:restart（会重新构建）
npm run car -- stop       # 停止（下次登录 macOS 会自动启动）
npm run car -- backup     # 立即备份
npm run car -- logs       # 最近日志
npm run car -- uninstall  # 移除服务与 App 图标，保留全部数据
```

## 手机访问

服务默认监听所有网卡。Mac 与手机在同一 Wi-Fi 时，在「设置 → 多设备」里可以看到局域网地址，用手机 Safari 打开并“添加到主屏幕”。所有数据接口都需要登录。如果只想本机访问，在 `.env` 中设置 `CAR_UTILS_HOST=127.0.0.1` 后运行 `npm run car -- restart`。

## 数据安全

- 迁移只读取 Docker 数据卷，从不修改或删除它。确认新版本稳定后，可以自行在 Docker Desktop 里删除旧容器；数据卷可以一直留作备份。
- 若需要重新从 Docker 导入：`npm run car -- migrate --force`（会先把当前数据库备份到 `backups/`）。
- 从备份恢复：停止服务，把 `backups/` 中的某个 `.sqlite` 复制为 `car-utils.sqlite`，再启动服务。
- 浏览器 `localStorage` 仍保留一份即时备份，后端暂时不可用时页面不会白屏，恢复后自动合并。

## Docker（可选）

旧的 Docker 方式仍然可用（`npm run docker:up`），适合部署到 NAS 或服务器。注意它使用独立的 Docker 数据卷，与本机原生版的数据库不是同一份。
