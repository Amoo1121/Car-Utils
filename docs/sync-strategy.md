# 数据同步策略

Car Utils 现在采用“本地优先 + 版本化备份 + CloudBase 可选同步”的路线，避免已有记录在多端迁移时丢失。

## 当前网页端

- 数据先保存在浏览器 `localStorage`，CloudBase 作为可选同步层。
- “同步”页面可以导出 `car-utils` JSON 备份。
- 导入备份时会合并数据，不会清空本机记录。
- CloudBase 同步会先拉取云端文档、与本机数据合并，再把合并结果回写云端。
- 云端同步文档使用同步密钥派生的 AES-GCM 密钥加密，CloudBase 数据库里不保存明文账本。
- 新增和编辑的数据会写入 `createdAt` / `updatedAt`，用于之后多端合并。
- 打开旧数据时会自动迁移到 schema v1，并补齐 `deletedAt`、`deviceId`、`source`、`schemaVersion`。
- 普通列表默认过滤 `deletedAt` 有值的数据，为后续回收站和恢复功能做准备。

## 合并规则

- `users`、`vehicles`、`fuelRecords`、`washRecords` 都按 `id` 合并。
- 本机没有的记录会直接加入。
- 同一条记录两端都存在时，保留 `updatedAt` 更新的一条。
- 旧数据没有时间戳时会先迁移补齐时间戳，再参与合并。
- `deletedAt` 会随着实体一起合并，后续删除同步不会依赖硬删除。

## CloudBase Web MVP

1. 在 CloudBase 创建环境和集合，默认集合名为 `car_utils_sync`。
2. Web 端填写环境 ID、地域、集合名和同步密钥。
3. 同步密钥会生成稳定文档 ID，并派生加密密钥。
4. 首次同步会上传本机账本；后续同步会双向合并。
5. Web SDK 需要把访问域名加入 CloudBase 安全域名白名单。出门使用建议部署到公网 HTTPS 域名。

## 微信小程序路线

1. 小程序首版复用同一份数据结构，支持导入网页端导出的 JSON。
2. 接入微信登录后，把当前同步密钥模式升级为 OpenID / UnionID 隔离保存。
3. 小程序和网页端都保留本地缓存，打开时拉取云端数据并执行合并。
4. 离线记录先写本地，网络恢复后再上传云端。
