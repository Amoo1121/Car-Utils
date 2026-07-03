# Car Utils 项目实现分析与重构说明

本文档用于交给 ChatGPT 或其他开发助手做下一轮重构。目标不是继续在现有实现上堆功能，而是先把项目从“单文件原型”整理成可维护的车辆生活账本应用。

当前项目已经能用，但实现质量不适合继续扩展。最核心的问题是：数据模型、业务规则、持久化、同步、统计、表单状态和 UI 全部混在少数几个文件里，尤其是 `src/App.tsx`。后续如果要继续做微信小程序、移动端体验、保养记录、费用记录、油耗分析、耗材库存等功能，必须先拆分架构边界。

## 1. 当前技术栈

- 前端：React 19 + TypeScript + Vite。
- 样式：纯 CSS，集中在 `src/styles.css`。
- 图标：`lucide-react`。
- 本地存储：浏览器 `localStorage`。
- 云同步：CloudBase Web SDK，使用 CloudBase 文档型数据库集合保存一个加密同步文档。
- PWA：`public/manifest.webmanifest` + `public/sw.js`。
- 部署：CloudBase 静态网站托管。

关键命令：

```bash
npm install
npm run dev
npm run dev:lan
npm run build
npm run deploy:cloudbase
```

当前线上地址：

```text
https://car-utils-sync-d8gc5l3xlb8350cdf-1446050640.tcloudbaseapp.com/
```

## 2. 当前文件规模

当前主要文件规模如下：

| 文件 | 行数 | 说明 |
| --- | ---: | --- |
| `src/App.tsx` | 3807 | 绝大多数 UI、表单、业务操作、统计逻辑都在这里 |
| `src/shared/carData.ts` | 798 | 数据类型、迁移、合并、本地备份、工具函数 |
| `src/shared/cloudSync.ts` | 339 | CloudBase 同步、客户端加密、配置持久化 |
| `src/styles.css` | 1390 | 全局样式、布局、表单、卡片、图表、响应式 |
| `public/sw.js` | 约 40 | 简单 PWA 缓存 |
| `README.md` / `docs/*.md` | 少量 | 运行、同步、iPhone 使用说明 |

结论：`App.tsx` 已经严重膨胀。当前不是“缺少几个组件拆分”的问题，而是缺少分层架构。

## 3. 当前业务能力

### 3.1 用户

当前是本地账户，不是真实服务端账号。

- 登录字段：昵称、邮箱。
- 相同邮箱会复用已有用户。
- `currentUserId` 存在 `Store` 根对象中。
- 没有密码、没有服务端身份校验。
- CloudBase 匿名登录只用于访问云端数据库，不等于业务用户登录。

### 3.2 车辆管理

已支持：

- 添加车辆。
- 编辑车辆。
- 归档车辆。
- 软删除车辆。
- 恢复车辆。
- 车辆字段包括昵称、品牌、型号、年份、车牌、能源类型、油箱容量、电池容量、VIN、当前里程、备注。

问题：

- 车辆操作逻辑写在 `App()` 内部。
- 删除车辆只删除车辆实体，不级联隐藏其加油/洗车记录；UI 通过当前车辆筛选间接隐藏。
- 没有明确的 `vehicleService`。
- 没有车辆字段校验层。

### 3.3 加油记录

已支持：

- 新增加油记录。
- 编辑加油记录。
- 软删除 / 恢复。
- 筛选：全部、本月、本年。
- 模糊搜索：加油站、油品、日期、金额等。
- 字段：日期、总里程、油品、自定义油品、升数、表显单价、实付金额、加油站、加油前油位、加油后油位、是否加满。
- 图表：实付单价趋势、单次实付金额。
- 加油站统计。
- 油品耐跑参考。

问题：

- `FuelForm` 和 `FuelRecordEditor` 大量重复。
- 加油记录 draft 类型、表单转换、校验、业务实体构造都在 `App.tsx`。
- 没有独立的 `fuelService` 或 `fuelAnalytics`。
- 油耗统计规则不统一：
  - `Dashboard` 的估算油耗用“所有有里程记录的总加油量 / 首尾里程差”，容易把第一笔加油量计入，从油耗学上不严谨。
  - `FuelInsights` 的油品耐跑分析依赖油箱容量、上一笔加油后油位、下一笔加油前油位，逻辑更谨慎，但与概览统计不是同一套算法。
  - `fullTank` 字段已经存在，但没有形成完整“满油法”计算。
  - 没有 confidence score，只是用样本数和区间筛选做粗略防误导。
- 没有异常数据提示，例如升数、价格、里程倒退、油位不合理。

### 3.4 洗车记录

已支持：

- 洗车记录新增、编辑、软删除、恢复。
- 洗车类型：DIY、店内普洗、店内精洗、机器洗车、其他。
- DIY 洗车可记录药剂/耗材。
- 字段包括日期、里程、洗车方式、项目、用时、成本、人工费、水电/场地费、效果评分、下次建议日期、备注、耗材使用。

问题：

- `WashForm`、`WashRecordFields`、`WashRecordEditor` 混杂了很多表单规则。
- DIY 和店内洗车逻辑混在同一个 `WashRecordDraft`。
- 成本计算逻辑和表单展示耦合。
- 耗材使用字段没有足够类型约束，例如 `capacityUnit` 和 `usedUnit` 可以出现业务上不合理的组合。
- 没有洗车分析，例如平均周期、耗材成本趋势、项目效果评分趋势。

### 3.5 洗车耗材仓库

已支持：

- 新增耗材。
- 编辑耗材。
- 补货。
- 删除 / 恢复。
- 类型筛选。
- 购买历史。
- 在洗车记录中选择仓库耗材。
- 根据购买价、容量、使用量估算单次成本。
- 根据历史使用量估算库存余量。

问题：

- 库存不是独立账本事件，而是从购买记录与洗车记录临时推导。
- 缺少“库存调整”记录，例如倒洒、丢失、赠品、拆封过期。
- `WashProductPurchase` 不是 `BaseEntity`，不能单独软删除、编辑历史、同步冲突处理。
- 编辑耗材时会覆盖最近一次购买记录，语义不够清晰。
- `getWashProductStats` 对单位混用处理较弱。

### 3.6 数据同步

当前同步方式：

- 本地数据存在 `localStorage` key：`car-utils-store-v1`。
- CloudBase 配置存在 `localStorage` key：`car-utils-cloud-sync-config-v1`。
- 云端集合：`car_utils_sync`。
- 云端文档 ID：由同步密钥 SHA-256 派生。
- 云端文档 payload：使用同步密钥 PBKDF2 派生 AES-GCM 密钥后加密。
- 同步流程：
  1. normalize 本地 Store。
  2. 读取云端文档。
  3. 解密云端 Store。
  4. `mergeStores(local, remote)`。
  5. 写回本地。
  6. 重新加密并 `set()` 到云端文档。

优点：

- 不直接上传明文账本。
- 免费 CloudBase 套餐不能添加安全域名时，使用 CloudBase 静态托管域名规避。
- 不依赖真实用户登录，电脑和手机只要同同步密钥就能同步。

问题：

- 这是 MVP 级“整包同步”，不是增量同步。
- CloudBase 集合权限是客户端读写，实际保护依赖客户端加密。
- 云端元数据仍可见，例如文档 ID、更新时间。
- 没有冲突 UI；`mergeStores` 是按实体 `updatedAt` 简单 last-write-wins。
- 没有云端版本历史。
- 没有同步锁；两端同时同步时可能出现最后写入覆盖。
- `syncState.pendingChanges` 类型存在，但目前没有真正使用。
- 默认 CloudBase envId 写死在代码中，不利于多环境或开源。

### 3.7 导入 / 导出

已支持：

- JSON 导出。
- JSON 导入并合并。
- 支持旧数据迁移到 schema v1。

问题：

- 没有导入预览。
- 没有冲突报告。
- 没有“仅当前用户 / 当前车辆 / 包含已删除”的导出选项。
- 导入失败信息较粗。

## 4. 当前数据模型

数据模型集中在 `src/shared/carData.ts`。

根对象：

```ts
export type Store = {
  users: User[];
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  washProducts: WashProduct[];
  expenseRecords: ExpenseRecord[];
  currentUserId?: string;
  deviceId?: string;
  schemaVersion?: number;
  syncState?: SyncState;
};
```

主要实体：

- `User`
- `Vehicle`
- `FuelRecord`
- `WashRecord`
- `WashProduct`
- `ExpenseRecord`
- `ChangeSet`

通用元信息：

```ts
export type BaseEntity = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
  deviceId?: string;
  source?: EntitySource;
  schemaVersion?: number;
};
```

需要注意：

- 当前代码同时使用 `userId`，而之前方案里提到过 `ownerId`。如果重构，要统一命名。
- `BaseEntity` 字段是 optional，但业务上迁移后应该是必填。
- `ExpenseRecord` 模型存在，但 UI 没有实现费用记录功能。
- `ChangeSet` 和 `SyncState.pendingChanges` 存在，但没有实际增量同步。

## 5. 当前迁移与合并逻辑

### 5.1 迁移

`normalizeStore(value)` 调用 `migrateData(raw)`。

迁移做了：

- 补齐 `deviceId`。
- 补齐 `createdAt` / `updatedAt` / `deletedAt` / `source` / `schemaVersion`。
- 迁移 users、vehicles、fuelRecords、washRecords、washProducts、expenseRecords。
- 按 email 合并重复用户。
- 将旧 userId 映射到合并后的 canonical userId。

问题：

- `DATA_SCHEMA_VERSION` 当前仍为 1，但模型已经多次扩展。
- 迁移函数会用当前时间补历史缺失字段，可能改变冲突排序语义。
- 没有显式 v0 -> v1 -> v2 pipeline，只有“无论传入什么都 normalize 到当前结构”。
- 没有迁移测试。

### 5.2 合并

`mergeStores(localStore, incomingStore)`：

- 两边先 normalize。
- 各实体数组按 id 合并。
- 同 id 取 `updatedAt` 较新的实体。
- `currentUserId` 优先 incoming。
- `syncState` 基本保留 local。

问题：

- 没有深度冲突检测。
- `updatedAt` 相等但内容不同不会报告冲突。
- 没有字段级 merge。
- 没有冲突 UI。
- 删除状态只作为实体字段参与 last-write-wins，没有专门 deletion tombstone 规则。

## 6. 当前 UI 架构

页面入口在 `src/App.tsx`。

顶层状态：

```ts
const [store, setStore] = useState<Store>(() => loadStore());
const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
const [activeTab, setActiveTab] = useState<AppTab>("overview");
const [navCollapsed, setNavCollapsed] = useState(false);
```

主导航 tab：

- `overview`
- `fuel`
- `wash`
- `vehicles`
- `sync`

加油子 tab：

- `analytics`
- `record`
- `history`

洗车子 tab：

- `record`
- `warehouse`
- `history`

问题：

- `App()` 是状态中心、repository、service、router、controller、view model 的混合体。
- 子组件通过大量 props 传递操作函数。
- 没有 React Router，tab 状态不在 URL 中，刷新后不能保留当前位置。
- 没有全局错误边界。
- 没有 toast/snackbar，状态提示都嵌在页面里。
- 大量表单状态是局部 `useState`，没有统一 form abstraction。
- 编辑器和新增表单重复。
- 没有组件目录结构。

## 7. 当前样式实现

样式全部在 `src/styles.css`。

优点：

- 视觉风格相对统一。
- 已有侧边栏、面板、列表、图表、响应式布局。

问题：

- 1390 行全局 CSS，缺少 design tokens 分层。
- class 命名没有严格模块边界。
- 后续功能会继续污染全局样式。
- 没有暗色模式。
- 没有组件级样式组织。
- 没有 Storybook 或视觉回归。

## 8. 当前 PWA 实现

`public/sw.js`：

- cache name 固定为 `car-utils-pwa-v1`。
- 缓存 app shell。
- same-origin GET 缓存优先。

问题：

- cache name 不随构建版本变化，容易出现旧 JS/CSS 资源缓存问题。
- 没有“新版本可用”提示。
- 没有离线写入队列。
- 默认 CloudBase 测试域名有风险提醒中间页，会影响首次 PWA 添加体验。

## 9. 当前测试与质量控制

当前没有发现：

- 单元测试。
- 组件测试。
- E2E 测试文件。
- ESLint 配置。
- Prettier 配置。
- TypeScript typecheck 独立脚本。

只有：

```bash
npm run build
```

问题：

- 所有核心数据迁移、merge、加密同步、油耗统计都没有自动测试。
- 重构风险非常高。
- 当前功能靠手动浏览器验证。

## 10. 最主要的问题清单

### P0：架构不可扩展

`App.tsx` 过大且职责混乱。任何修改都会触碰大量上下文，导致回归风险高。

### P0：数据兼容风险

已经有真实用户数据和云同步，重构必须保证：

- `localStorage` 旧数据可迁移。
- CloudBase 旧加密文档可解密。
- JSON 备份可导入。
- 软删除记录不丢。

### P1：同步策略过于粗糙

整包同步可以继续作为 MVP，但需要：

- 显式冲突检测。
- 同步锁或版本检查。
- 云端版本记录。
- 更好的错误提示。

### P1：统计逻辑不可信

油耗、油品耐跑、加油站分析应该从 UI 中拆出来，形成可测试算法，并输出 confidence。

### P1：表单重复严重

新增和编辑表单重复，尤其是加油和洗车记录。

### P1：没有测试

重构前必须先给数据层和算法层补测试。

### P2：部署和配置混杂

CloudBase envId 直接写在代码里。短期可接受，但长期应改成环境配置。

### P2：权限安全依赖客户端加密

集合允许客户端读写，数据本体加密，但仍不是理想模型。长期应改成云函数或真实用户权限。

## 11. 推荐目标架构

建议分成以下目录：

```text
src/
  app/
    App.tsx
    routes.tsx
    providers/
      StoreProvider.tsx
      ToastProvider.tsx

  domain/
    common/
      entity.ts
      units.ts
      validation.ts
    user/
      userTypes.ts
      userService.ts
    vehicle/
      vehicleTypes.ts
      vehicleService.ts
    fuel/
      fuelTypes.ts
      fuelService.ts
      fuelAnalytics.ts
      fuelValidation.ts
    wash/
      washTypes.ts
      washService.ts
      washProductService.ts
      washAnalytics.ts
      washValidation.ts
    expense/
      expenseTypes.ts
      expenseService.ts
    sync/
      syncTypes.ts
      merge.ts
      cloudSync.ts
      encryption.ts
      importExport.ts

  repositories/
    carDataRepository.ts
    localStorageRepository.ts
    cloudbaseRepository.ts

  components/
    layout/
    forms/
    charts/
    ui/

  features/
    auth/
    vehicles/
    fuel/
    wash/
    sync/
    overview/

  shared/
    constants.ts
    date.ts
    number.ts
```

调用方向：

```text
UI / Feature components
  -> service/use-case
  -> domain model + validation + analytics
  -> repository interface
  -> localStorage / CloudBase implementation
```

禁止：

- UI 组件直接 `localStorage.setItem`。
- UI 组件直接写复杂 merge。
- UI 组件直接做油耗算法。
- 继续把新功能写进 `App.tsx`。

## 12. 建议先保留的数据兼容层

重构时不要直接改 storage key。

必须保留：

```ts
export const STORAGE_KEY = "car-utils-store-v1";
export const CLOUD_SYNC_CONFIG_KEY = "car-utils-cloud-sync-config-v1";
```

建议新增：

```ts
export const CURRENT_SCHEMA_VERSION = 2;
```

但迁移应支持：

- legacy 无版本数据。
- schema v1 当前数据。
- 将来 schema v2。

建议重构成：

```ts
function migrate(raw: unknown): StoreV2 {
  const version = detectSchemaVersion(raw);
  if (version === 0) return migrateV1ToV2(migrateV0ToV1(raw));
  if (version === 1) return migrateV1ToV2(raw);
  if (version === 2) return normalizeV2(raw);
  throw new Error("Unsupported schema version");
}
```

## 13. 推荐新的核心类型原则

### 13.1 BaseEntity 字段改成必填

当前是 optional，重构后 domain 层应保证必填：

```ts
type BaseEntity = {
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  deviceId: string;
  source: EntitySource;
  schemaVersion: number;
};
```

如果不想所有实体都有 `userId`，则使用：

```ts
type OwnedEntity = BaseEntity & {
  userId: string;
};
```

### 13.2 Draft 类型不要放在 `App.tsx`

例如：

```text
domain/fuel/fuelFormModel.ts
domain/wash/washFormModel.ts
```

### 13.3 单位需要建模

洗车耗材单位不要简单字符串混用。建议：

```ts
type VolumeUnit = "ml" | "L";
type WeightUnit = "g" | "kg";
type CountUnit = "pcs";
type ProductUnitKind = "volume" | "weight" | "count";
```

每个耗材应确定 unit kind，避免“购买单位 pcs、使用单位 ml”的不合理组合。

## 14. 推荐服务层

### 14.1 StoreService

职责：

- load。
- save。
- replace。
- transact。
- record change set。

示例：

```ts
type StoreTransaction = (store: Store) => Store;

class StoreService {
  load(): Store;
  commit(transaction: StoreTransaction): Store;
  replace(store: Store): Store;
}
```

### 14.2 VehicleService

职责：

- addVehicle。
- updateVehicle。
- archiveVehicle。
- deleteVehicle。
- restoreVehicle。
- listActiveVehicles。
- listDeletedVehicles。

### 14.3 FuelService

职责：

- addFuelRecord。
- updateFuelRecord。
- deleteFuelRecord。
- restoreFuelRecord。
- validateFuelRecord。
- buildFuelRecordFromDraft。
- createDraftFromFuelRecord。

### 14.4 FuelAnalyticsService

职责：

- basic stats。
- fuel trend points。
- station summary。
- rough consumption。
- full-tank consumption。
- fuel-level estimated consumption。
- confidence score。

### 14.5 WashService / WashProductService

职责：

- wash record CRUD。
- wash product CRUD。
- purchase history CRUD。
- usage cost estimation。
- stock estimation。
- validation。

### 14.6 SyncService

职责：

- local import/export。
- cloud sync。
- encryption。
- merge。
- conflict report。

## 15. 推荐组件拆分

### 15.1 Layout

```text
components/layout/AppShell.tsx
components/layout/SideNav.tsx
components/layout/PageHeader.tsx
components/layout/VehicleSwitcher.tsx
```

### 15.2 UI primitives

```text
components/ui/Button.tsx
components/ui/Panel.tsx
components/ui/SegmentedControl.tsx
components/ui/Field.tsx
components/ui/EmptyState.tsx
components/ui/ConfirmDialog.tsx
components/ui/Toast.tsx
components/ui/LineChart.tsx
```

### 15.3 Features

```text
features/fuel/FuelPage.tsx
features/fuel/FuelForm.tsx
features/fuel/FuelRecordList.tsx
features/fuel/FuelRecordEditor.tsx
features/fuel/FuelInsights.tsx

features/wash/WashPage.tsx
features/wash/WashForm.tsx
features/wash/WashRecordList.tsx
features/wash/WashProductWarehouse.tsx
features/wash/WashProductForm.tsx

features/vehicles/VehiclePage.tsx
features/vehicles/VehicleForm.tsx
features/vehicles/VehicleList.tsx

features/sync/SyncPage.tsx
features/sync/CloudSyncCard.tsx
features/sync/ImportExportCard.tsx
```

## 16. 推荐测试计划

重构前先补数据层测试。

建议引入：

```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

新增脚本：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc -b --noEmit"
}
```

必须优先测试：

1. `migrateData`
   - legacy 空数据。
   - 缺时间戳数据。
   - 重复 email 用户合并。
   - 车辆/记录 userId 映射。

2. `mergeStores`
   - 本地新增 + 云端新增。
   - 同 id 本地更新较新。
   - 同 id 云端更新较新。
   - deletedAt 较新。
   - same updatedAt but different content 应进入 conflict。

3. `fuelAnalytics`
   - 数据不足不输出结论。
   - 粗略油耗。
   - 满油法。
   - 油位估算法。
   - 异常值过滤。

4. `washProductService`
   - 成本估算。
   - 单位换算。
   - 库存余量。
   - 无容量耗材。

5. `cloudSync`
   - 加密后不含明文。
   - 同步密钥相同可解密。
   - 同步密钥不同无法解密。
   - remote missing 时创建。
   - remote existing 时 merge。

## 17. 分阶段重构路线

### Phase 1：建立测试和数据层边界

目标：

- 不改 UI 行为。
- 抽出 `carData` 为 domain/store/migration/merge。
- 给 migration 和 merge 补测试。
- 保证旧 localStorage 和 JSON 备份仍可用。

交付：

- `src/domain/common`
- `src/domain/store`
- `src/repositories/localStorageRepository.ts`
- `vitest` 测试。

### Phase 2：抽出业务服务

目标：

- `App.tsx` 不再直接 map 数组做 CRUD。
- 新增 `vehicleService`、`fuelService`、`washService`。
- 所有新增/编辑/删除都经过 service。

交付：

- `src/domain/vehicle/vehicleService.ts`
- `src/domain/fuel/fuelService.ts`
- `src/domain/wash/washService.ts`
- `src/domain/wash/washProductService.ts`

### Phase 3：抽出统计分析

目标：

- 油耗算法从 UI 中移走。
- 洗车耗材库存从 UI 中移走。
- 输出可解释的 confidence。

交付：

- `fuelAnalytics.ts`
- `washAnalytics.ts`
- 单元测试。

### Phase 4：拆 UI

目标：

- `App.tsx` 降到 200 行以内，只负责 providers、layout、route/tab。
- 每个 feature 独立目录。
- 复用表单组件。

交付：

- `features/fuel`
- `features/wash`
- `features/vehicles`
- `features/sync`
- `components/ui`

### Phase 5：同步增强

目标：

- `syncState.pendingChanges` 真正使用。
- 同步从整包覆盖升级为“整包 merge + version check”或增量 changeset。
- 有冲突报告和导入预览。

交付：

- `syncService`
- `conflictService`
- `ImportPreview`
- `SyncStatus`

### Phase 6：移动端体验整理

目标：

- 更适合 iPhone 单手记录。
- 表单改成分段 / bottom sheet / sticky action。
- PWA 缓存版本化。

交付：

- 移动端布局优化。
- 新版本提示。
- 离线提示。

## 18. 不建议做的事

- 不要一次性全量重写并丢掉旧数据兼容。
- 不要直接更换 localStorage key。
- 不要把 CloudBase 同步改成明文。
- 不要在没有测试的情况下改 migration/merge。
- 不要继续往 `App.tsx` 加功能。
- 不要把微信小程序和 Web 重构一起做。

## 19. 当前已知技术债细节

### 19.1 `App.tsx` 中过多职责

`App.tsx` 同时包含：

- localStorage 读写。
- 登录。
- 所有实体 CRUD。
- tab/router 状态。
- 车辆选择。
- 加油表单。
- 洗车表单。
- 耗材仓库。
- 图表。
- 油耗分析。
- 导入导出。
- 云同步 UI。

这会导致任何功能都难以测试。

### 19.2 `carData.ts` 命名和职责混杂

它既是：

- 类型定义。
- 常量定义。
- 迁移层。
- merge 层。
- 数据工具层。
- 筛选和模糊搜索层。

应拆分。

### 19.3 `cloudSync.ts` 与具体 CloudBase 环境耦合

当前默认：

```ts
const DEFAULT_CLOUDBASE_ENV_ID = "car-utils-sync-d8gc5l3xlb8350cdf";
```

短期为个人应用可接受；长期应通过配置注入。

### 19.4 `README.md` 仍有旧安全域名描述

README 中仍写到“为 Web SDK 配置安全域名”。实际现在使用 CloudBase 静态托管默认域名绕过免费套餐安全域名限制。后续应统一文档口径。

### 19.5 PWA 缓存可能导致旧版本

`CACHE_NAME = "car-utils-pwa-v1"` 固定。部署后浏览器可能继续使用旧缓存。

建议重构为：

```ts
const CACHE_NAME = `car-utils-pwa-${APP_VERSION}`;
```

并在页面中提示用户刷新。

## 20. 给 ChatGPT 的建议重构 Prompt

可以直接把下面这段发给 ChatGPT，并附上本项目代码。

```text
你是高级前端架构师。请重构 Car Utils 项目。

项目现状：
- React 19 + TypeScript + Vite。
- 主要代码集中在 src/App.tsx，约 3800 行。
- 数据模型和迁移在 src/shared/carData.ts。
- CloudBase 加密同步在 src/shared/cloudSync.ts。
- 全局样式在 src/styles.css。
- 已有真实数据，必须保持 localStorage、JSON 备份和 CloudBase 同步文档兼容。

重构目标：
1. 不丢失任何现有用户数据。
2. 不改变现有主要功能行为。
3. 先拆数据层、服务层、统计层，再拆 UI。
4. 给迁移、merge、油耗统计、耗材库存、CloudBase 加密同步补单元测试。
5. App.tsx 最终只保留应用壳、导航、页面装配，不超过 200 行。

请按阶段实施，不要一次性全量重写。

第一阶段只做：
- 引入 Vitest。
- 把 src/shared/carData.ts 拆成 domain/store/types.ts、migration.ts、merge.ts、utils.ts。
- 保留原导出兼容，避免 App.tsx 立刻大改。
- 添加 migration 和 merge 测试。
- npm run build 和 npm test 必须通过。

特别注意：
- STORAGE_KEY 不能改。
- CLOUD_SYNC_CONFIG_KEY 不能改。
- CloudBase 加密文档格式不能破坏。
- BaseEntity 的 deletedAt 是软删除 tombstone，不要硬删除。
- 同步密钥不能上传或明文保存到云端。
```

## 21. 推荐最终验收标准

重构完成后应满足：

- `npm run build` 通过。
- `npm test` 通过。
- `src/App.tsx` 小于 200 行。
- 没有页面直接调用 `localStorage.setItem`，除 repository 外。
- 没有 UI 组件直接实现 merge/migration。
- 加油统计、洗车耗材统计有单元测试。
- JSON 导入旧备份成功。
- CloudBase 同步旧文档成功。
- iPhone Safari 可打开线上地址、登录、同步、添加到主屏幕。

## 22. 当前项目一句话结论

Car Utils 已经从“可用原型”长成了“有真实数据和同步需求的个人应用”，但代码仍停留在原型组织方式。下一步不应该继续加功能，而应该先用测试保护数据，再把单文件巨石拆成 domain、service、repository、feature UI 四层。
