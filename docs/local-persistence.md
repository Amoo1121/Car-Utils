# Car Utils 本地持久化说明

本文档说明 Car Utils 的本地 Docker 后端、密码认证与 SQLite 持久化方案。

## 为什么从 localStorage 迁移到 SQLite

浏览器 `localStorage` 适合原型阶段，但不适合长期保存真实车辆账本数据：

- 浏览器清理缓存、切换浏览器或隐私模式可能导致数据不可见。
- 手机和电脑之间无法依赖同一份浏览器存储。
- 后续要做本地后端、用户认证、实体表、导入合并和同步队列时，需要一个更稳定的持久化边界。

车辆账本仍以完整 `Store` JSON payload 存入 SQLite，但现在按认证用户隔离。认证用户、会话和用户 Store 分表保存，不改变业务数据模型、JSON 导入导出格式和 CloudBase 加密同步格式。

## 启动方式

日常使用推荐双击项目根目录的：

```text
start-car-utils.command
```

它会启动 `car-utils-web` 和 `car-utils-server` 两个后台容器，并打开 `http://localhost:4173/`。关闭脚本产生的 Terminal 窗口不会停止服务。需要停止时双击 `stop-car-utils.command`。

对应命令为：

```bash
npm run app:up
npm run app:status
npm run app:stop
```

后台 Web 容器提供生产构建，并通过同源 `/api` 代理访问后端。详细说明见 [background-operation.md](background-operation.md)。

### 开发模式

日常开发直接启动：

```bash
npm run dev
```

该命令会先构建并启动 Docker 后端，再启动 Vite。后端默认监听：

```text
http://localhost:3001
```

需要让手机通过局域网访问时：

```bash
npm run dev:lan
```

Vite 开发服务器会把 `/api` 请求代理到 `http://localhost:3001`。

### 自定义端口

在项目根目录复制环境变量示例：

```bash
cp .env.example .env
```

例如将前端改到 5180、Docker 暴露的 API 改到 3101：

```env
CAR_UTILS_WEB_PORT=5180
CAR_UTILS_APP_PORT=4174
CAR_UTILS_API_PORT=3101
CAR_UTILS_API_INTERNAL_PORT=3001
```

修改后重新执行相应启动命令。Vite `/api` 代理、后台 Web 端口和 Docker API 端口映射都会读取配置。容器内部端口通常保持 3001 即可。

只启动或修复后端容器：

```bash
npm run backend:up
```

容器配置了 `restart: unless-stopped`。Docker Desktop 或 Docker daemon 重启后，容器会自动恢复；手动执行 `npm run backend:stop` 后则保持停止，直到再次运行 `backend:up`。

## API

后端提供以下接口：

```text
GET /api/health
POST /api/auth/register
POST /api/auth/login
GET /api/auth/session
POST /api/auth/logout
PATCH /api/auth/profile
PUT /api/auth/password
GET /api/admin/users
PATCH /api/admin/users/:userId/status
GET /api/store
PUT /api/store
GET /api/product-lookup?query=品牌%20产品名称
```

除健康检查、注册、登录和耗材公开资料查询外，账户与 Store 接口都需要有效的 HttpOnly 会话 Cookie。密码以 scrypt 加盐哈希保存，数据库不保存明文密码；会话表只保存随机令牌的 SHA-256 哈希。

`GET /api/store` 在当前认证用户没有数据时返回 `404` 和 `{ "store": null }`。前端会识别这个状态，并尝试从旧的浏览器 `localStorage` 自动迁移。

`PUT /api/store` 接收完整 Store JSON，后端只做基础对象校验，然后保存：

- `schema_version`
- `payload`
- `updated_at`
- `version`

后端会通过响应头返回当前版本：

```text
x-car-utils-store-version
x-car-utils-updated-at
```

前端保存时会带上 `If-Match` 或 `If-None-Match`，避免多个浏览器窗口用旧 Store 覆盖新 Store。

`GET /api/product-lookup` 用于耗材仓库的联网资料补全。后端会搜索公开产品页并提取候选图片、简介、容量和来源，前端只在用户确认候选后写入 Store。搜索失败不影响手动添加耗材，也不会改变 SQLite 和浏览器备份的保存链路。

## SQLite 文件和 Docker volume

容器内数据库路径：

```text
/app/data/car-utils.sqlite
```

`docker-compose.yml` 使用 named volume：

```text
car-utils-sqlite
```

查看 volume：

```bash
docker volume ls | grep car-utils
```

## 备份数据库

可以把 SQLite 文件从容器中复制出来：

```bash
docker compose cp car-utils-server:/app/data/car-utils.sqlite ./car-utils.sqlite.backup
```

也可以备份整个 volume：

```bash
docker run --rm \
  -v car-utils-sqlite:/data \
  -v "$PWD":/backup \
  busybox \
  cp /data/car-utils.sqlite /backup/car-utils.sqlite.backup
```

## 旧 localStorage 数据如何自动迁移

前端现在使用按认证账户创建的 hybrid repository：

1. 用户使用邮箱和密码注册或登录。
2. 后端先按认证用户 ID 读取 `user_stores`。
3. 若用户 Store 为空，后端会尝试从旧 `app_store` 中按注册邮箱认领历史数据。
4. 若后端仍为空，前端读取旧 `localStorage` 的 `car-utils-store-v1`，按同一邮箱提取该账户的数据。
5. 数据经过 `normalizeStore` 后写入认证用户的 SQLite Store。
6. 迁移成功后，不删除根 legacy backup；认证账户另有隔离的浏览器备份 key。
7. 后续每次保存，会先同步写账户级 `localStorage` backup，再排队写入后端。
8. 如果刷新或关闭页面导致后端未及时写入，下次打开时会比较 backup 时间和后端更新时间；backup 更新时会优先恢复并写回后端。

`STORAGE_KEY` 仍然是：

```text
car-utils-store-v1
```

账户级浏览器备份以该 key 为前缀并附加认证用户 ID。根 key 不会被删除，继续承担旧数据迁移和最后一道人工恢复保障。

## API 不可用时的行为

如果 Docker 后端没有启动，前端不会白屏：

- 控制台会输出 warning。
- 前端会降级读取旧 `localStorage`。
- 保存时会保留 `localStorage` backup。
- 后端恢复后，保存会使用现有 `mergeStores` 和版本检查，尽量避免旧窗口覆盖新数据。

这只是本地开发阶段的保险策略。长期方案仍然应该以 SQLite 后端或后续统一同步层为准。

## 手动验证步骤

1. 运行 `docker compose up -d --build --force-recreate --wait`。
2. 运行 `npm run dev`。
3. 用无密码版本中完全相同的邮箱注册，确认已有旧数据能显示。
4. 新增或编辑一条记录。
5. 刷新页面，确认数据仍在。
6. 停止并重启后端容器：

```bash
docker compose restart car-utils-server
```

7. 再刷新页面，确认数据仍在。

## 当前限制

- 本阶段没有把 Store 拆成 users、vehicles、fuelRecords 等业务表。
- 本阶段没有改 CloudBase 加密同步格式。
- 本阶段没有实现后端 merge。前端仍然负责 `normalizeStore` 和必要的 merge。
- 后端只做基础 JSON 对象校验，不做完整业务 schema validation。
- 认证后端当前运行在本机 Docker；CloudBase 静态托管站点若要使用同一账户，需要一个公网 HTTPS 后端。

## 后续计划

- 增加 repository/service 层测试覆盖 CloudBase 同步入口。
- 增加管理员创建账户、密码重置与审计日志。
- 将整包 Store 逐步实体表化。
- 引入后端 migration 和 schema validation。
- 统一本地 SQLite、CloudBase 和未来小程序同步的冲突合并策略。
