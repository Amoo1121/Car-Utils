# Car Utils 后台常驻使用指南

Car Utils 的日常版由两个 Docker 容器组成：

- `car-utils-web`：提供已经构建好的 React 页面，并代理 `/api` 请求。
- `car-utils-server`：提供密码认证、业务 Store API 和 SQLite 持久化。

两者都使用 `restart: unless-stopped`。启动完成后不依赖 PyCharm、VS Code、npm、pnpm 或任何持续打开的 Terminal。

## 一键启动

1. 在 Finder 打开 Car Utils 项目目录。
2. 双击 `start-car-utils.command`。
3. 首次运行时等待 Docker 镜像构建完成。
4. 浏览器会自动打开 `http://localhost:4173/`。
5. 页面打开后可以关闭 Terminal。

脚本发现 Docker Desktop 未运行时，会自动打开 Docker Desktop，并等待它准备完成后继续。

如果 macOS 首次询问使用哪个程序打开 `.command` 文件，请选择 Terminal。脚本是项目内的纯文本文件，可以用任意编辑器查看内容。

## 停止

双击：

```text
stop-car-utils.command
```

或执行：

```bash
npm run app:stop
```

停止只会停止容器，不会删除 SQLite 文件、账户、会话表或 Docker volume。

## 查看状态

```bash
npm run app:status
```

正常情况下应看到：

```text
car-utils-web      healthy
car-utils-server   healthy
```

查看最近日志：

```bash
docker compose --profile desktop logs --tail=100
```

持续查看日志：

```bash
npm run app:logs
```

## Mac 重启后的行为

在 Docker Desktop 设置中启用登录时自动启动。只要容器不是通过停止脚本主动停止，Docker Desktop 启动后会根据 `restart: unless-stopped` 恢复 Car Utils。

若容器没有自动恢复，再双击一次 `start-car-utils.command` 即可。该操作是幂等的，不会重复创建数据库，也不会覆盖 Store。

## 后台版与开发版的区别

| 用途 | 地址 | 是否依赖 Terminal |
| --- | --- | --- |
| 后台日常版 | `http://localhost:4173/` | 否 |
| Vite 开发版 | `http://localhost:5173/` 或 `.env` 中的开发端口 | 是 |

两个地址是不同的浏览器来源，因此 localStorage 备份相互独立，但它们连接同一个 SQLite 后端。同一主机名的 Cookie 不按端口隔离，登录会话可能共用；若页面要求登录，使用原账户即可，车辆账本仍来自同一份 SQLite 数据。

## 自定义后台端口

在项目根目录 `.env` 中设置：

```env
CAR_UTILS_APP_PORT=4174
```

重新双击启动脚本后，使用 `http://localhost:4174/`。请尽量固定端口，避免 `localStorage` 备份分散到不同浏览器来源。

## 更新代码后

拉取或修改代码后，再次双击启动脚本即可。脚本执行带构建的 `docker compose up`，会在需要时重建前后端镜像，并保留现有 SQLite volume。

## 常见问题

### 容器健康，但页面提示后端不可用

先验证页面实际使用的代理地址（自定义端口时替换 4173）：

```bash
curl -i http://localhost:4173/api/health
```

正常返回 `200` 和 `{"ok":true}`。Web 容器的健康检查也会验证这条代理链路。

旧版本的 PWA Service Worker 曾错误缓存 `/api/store` 和登录会话，导致读取旧版本、保存返回 `409`，最终被误报为后端不可用。更新后只对页面资源使用离线缓存，API 响应标记 `Cache-Control: no-store`；新 Service Worker 会自动清理旧 PWA 缓存，保留 localStorage 和 SQLite。

重新运行启动脚本后刷新页面，待更新完成后再点页面右上角“刷新后端数据”。如果第一次仍有旧提示，再刷新一次即可让新 Service Worker 接管。无需清除网站数据或删除浏览器备份。

### 端口被占用

修改 `.env` 中的 `CAR_UTILS_APP_PORT`，然后重新启动。日常后台端口与 `CAR_UTILS_WEB_PORT` 开发端口应使用不同数字。

### 页面打不开

依次检查：

```bash
docker info
npm run app:status
docker compose --profile desktop logs --tail=100
```

### 数据会不会随着容器停止消失

不会。SQLite 文件位于 Docker named volume `car-utils_car-utils-sqlite`。停止或重建容器不会删除它。只有显式执行带 `-v` 的删除命令才会删除 volume，因此不要执行：

```bash
docker compose down -v
```
