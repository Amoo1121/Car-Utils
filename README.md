# Car Utils

一台车的全部账目、提醒和数据，放在你自己的电脑上。

- **记一笔**：加油 / 充电、洗车（DIY 耗材自动算成本、扣库存）、保养、保险、年检、停车、维修……按 `N` 或点 `＋` 一步进入。
- **提醒**：保养、保险、年检等费用可设置下次日期或里程，首页按紧急程度提醒；按日均里程估算何时到期。
- **洞察**：真实油耗（支持“加满法”和“油表刻度法”）、每公里成本、月度支出构成、加油站对比、油价走势。
- **记录**：所有记录在一条时间线里，按月汇总、模糊搜索、导出 CSV；删除可撤销，回收站可恢复。
- **车库**：多车管理与归档；洗车耗材仓库带常用药剂库和联网查找产品资料。
- **⌘K**：搜索记录、跳转页面、切换车辆。支持深色模式，桌面与手机自适应。

## 安装与启动（macOS）

需要 Node.js 22+。

```bash
npm run setup
```

或在 Finder 中双击 `start-car-utils.command`。完成后：

- 从 Launchpad / Spotlight 打开 **Car Utils**（`~/Applications/Car Utils.app`）。
- 服务登录 macOS 时自动启动、崩溃自动恢复，不需要 Docker、Terminal 或 IDE。
- 数据库：`~/Library/Application Support/Car Utils/car-utils.sqlite`，每天自动备份到同目录的 `backups/`。

从旧的 Docker 版升级时，安装脚本会自动停止旧容器并**复制**其 SQLite 数据（Docker 数据卷保持不动），账户、密码和所有记录都会保留。访问地址仍是 `http://localhost:4173/`，浏览器内的备份也继续有效。

常用命令：

```bash
npm run app:status        # 运行状态与数据位置
npm run app:restart       # 更新代码后重新构建并重启
npm run car -- backup     # 立即备份
npm run car -- stop       # 停止服务
npm run car -- uninstall  # 移除服务与 App 图标（保留数据）
```

更多细节（手机访问、从备份恢复、可选 Docker 部署）见 [docs/background-operation.md](docs/background-operation.md)。

## 开发

```bash
npm install && npm --prefix server install
npm run dev        # http://localhost:5173/，/api 代理到本机常驻服务（4173）
npm test           # 前端 vitest + 后端 node:test
npm run typecheck
```

开发服务器和已安装的 App 读写同一个数据库。如果需要独立的后端，设置 `CAR_UTILS_API_PORT` 指向另一个进程，例如：

```bash
PORT=3101 CAR_UTILS_DB_PATH=/tmp/dev.sqlite node server/dist/index.js
CAR_UTILS_API_PORT=3101 npm run dev
```

### 目录结构

```text
src/
  app/          会话、路由、工作区上下文、外壳与命令面板
  domain/       纯业务逻辑：油耗、成本、提醒、时间线、各类记录服务（有单元测试）
  features/     页面（home / timeline / insights / garage / settings）与编辑器
  repositories/ SQLite API、localStorage 备份、认证
  ui/           Sheet、表单字段、图表、Toast 等基础组件
  styles/       设计令牌与样式
server/src/     Fastify：认证、Store、静态页面、自动备份、系统信息
scripts/        car-utils.mjs：安装 launchd 服务、生成 .app、迁移旧数据
```

## 数据与同步

- 每个账户拥有独立的 Store；密码使用 scrypt 加盐哈希，会话为 HttpOnly Cookie。
- 浏览器 `localStorage` 保留即时备份；服务暂时不可用时页面降级使用备份，恢复后自动合并。窗口重新获得焦点时会自动拉取其他设备的修改。
- 「设置 → 数据与备份」可导出 / 导入 JSON（按记录合并，不覆盖）、手动创建数据库快照；「记录」页可按筛选导出 CSV。
- 「设置 → 多设备」显示局域网地址，并保留 CloudBase 加密云同步，见 [docs/sync-strategy.md](docs/sync-strategy.md) 与 [docs/iphone-cloudbase-guide.md](docs/iphone-cloudbase-guide.md)。

联网查找耗材资料时只发送你输入的品牌和名称，不发送车辆、账户或记录数据；候选资料需要你确认后才会写入。
