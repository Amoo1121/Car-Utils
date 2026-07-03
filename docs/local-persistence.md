# Car Utils 本地持久化说明

本文档说明 Car Utils 第二阶段的本地 Docker 后端与 SQLite 持久化方案。

## 为什么从 localStorage 迁移到 SQLite

浏览器 `localStorage` 适合原型阶段，但不适合长期保存真实车辆账本数据：

- 浏览器清理缓存、切换浏览器或隐私模式可能导致数据不可见。
- 手机和电脑之间无法依赖同一份浏览器存储。
- 后续要做本地后端、用户认证、实体表、导入合并和同步队列时，需要一个更稳定的持久化边界。

本阶段不拆业务表，只把完整 `Store` 作为 JSON payload 存入 SQLite。这样可以先降低数据丢失风险，同时不改变现有数据模型、导入导出格式和 CloudBase 加密同步格式。

## 启动方式

先启动本地后端：

```bash
docker compose up --build
```

后端默认监听：

```text
http://localhost:3001
```

再启动前端：

```bash
npm run dev
```

Vite 开发服务器会把 `/api` 请求代理到 `http://localhost:3001`。

## API

后端提供三个基础接口：

```text
GET /api/health
GET /api/store
PUT /api/store
```

`GET /api/store` 在没有数据时返回 `404` 和 `{ "store": null }`。前端会识别这个状态，并尝试从旧的浏览器 `localStorage` 自动迁移。

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

前端现在使用 hybrid repository：

1. 先请求 `GET /api/store`。
2. 如果后端已有数据，直接使用后端数据。
3. 如果后端没有数据，读取旧 `localStorage` 中的 `car-utils-store-v1`。
4. 如果旧数据存在，先 `normalizeStore`，再 `PUT /api/store` 写入 SQLite。
5. 迁移成功后，不删除 `localStorage`，继续保留为 legacy backup。
6. 后续每次保存，会先同步写一份 `localStorage` backup，再排队写入后端。
7. 如果刷新或关闭页面导致后端未及时写入，下次打开时会比较 backup 时间和后端更新时间；backup 更新时会优先恢复并写回后端。

`STORAGE_KEY` 仍然是：

```text
car-utils-store-v1
```

## API 不可用时的行为

如果 Docker 后端没有启动，前端不会白屏：

- 控制台会输出 warning。
- 前端会降级读取旧 `localStorage`。
- 保存时会保留 `localStorage` backup。
- 后端恢复后，保存会使用现有 `mergeStores` 和版本检查，尽量避免旧窗口覆盖新数据。

这只是本地开发阶段的保险策略。长期方案仍然应该以 SQLite 后端或后续统一同步层为准。

## 手动验证步骤

1. 运行 `docker compose up --build`。
2. 运行 `npm run dev`。
3. 打开页面并确认已有旧数据能显示。
4. 新增或编辑一条记录。
5. 刷新页面，确认数据仍在。
6. 停止并重启后端容器：

```bash
docker compose restart car-utils-server
```

7. 再刷新页面，确认数据仍在。

## 当前限制

- 本阶段没有真实用户认证。
- 本阶段没有把 Store 拆成 users、vehicles、fuelRecords 等业务表。
- 本阶段没有改 CloudBase 加密同步格式。
- 本阶段没有实现后端 merge。前端仍然负责 `normalizeStore` 和必要的 merge。
- 后端只做基础 JSON 对象校验，不做完整业务 schema validation。

## 后续计划

- 增加 repository/service 层测试覆盖 CloudBase 同步入口。
- 设计本地用户身份与多用户数据隔离。
- 将整包 Store 逐步实体表化。
- 引入后端 migration 和 schema validation。
- 统一本地 SQLite、CloudBase 和未来小程序同步的冲突合并策略。
