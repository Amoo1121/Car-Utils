export type EnergyType = "汽油" | "柴油" | "混动" | "纯电" | "增程";

export type EntitySource = "web" | "miniapp" | "import" | "cloud" | "migration";

export type EntityType = "user" | "vehicle" | "fuel" | "wash" | "expense";

export type BaseEntity = {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
  deviceId?: string;
  source?: EntitySource;
  schemaVersion?: number;
};

export type UserSettings = {
  defaultVehicleId?: string;
  distanceUnit: "km" | "mile";
  currency: "CNY" | "USD";
  fuelVolumeUnit: "L" | "gal";
  theme?: "light" | "dark" | "system";
};

export type User = BaseEntity & {
  type?: "user";
  name: string;
  email: string;
  openId?: string;
  unionId?: string;
  avatarUrl?: string;
  settings?: UserSettings;
};

export type Vehicle = BaseEntity & {
  type?: "vehicle";
  userId: string;
  nickname: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  energyType: EnergyType;
  tankSize?: number;
  batterySize?: number;
  vin?: string;
  currentOdometer?: number;
  note?: string;
  presetId?: string;
  isArchived?: boolean;
};

export type PaymentMethod = "wechat" | "alipay" | "cash" | "credit_card" | "fuel_card" | "other";

export type RoadCondition = "city" | "highway" | "mixed" | "unknown";

export type FuelRecord = BaseEntity & {
  type?: "fuel";
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  volume: number;
  pricePerUnit: number;
  fuelGrade?: string;
  paidAmount?: number;
  fuelLevelBefore?: number;
  fuelLevelAfter?: number;
  totalCost: number;
  station: string;
  fullTank: boolean;
  paymentMethod?: PaymentMethod;
  originalAmount?: number;
  discountAmount?: number;
  couponAmount?: number;
  memberDiscountAmount?: number;
  roadCondition?: RoadCondition;
  acUsageLevel?: 0 | 1 | 2 | 3;
  loadLevel?: 0 | 1 | 2 | 3;
  tirePressureKpa?: number;
  weather?: string;
  temperatureC?: number;
  receiptImageIds?: string[];
  note?: string;
};

export type WashType =
  | "diy"
  | "shop_basic"
  | "shop_detailing"
  | "machine"
  | "detailing"
  | "wax"
  | "interior"
  | "glass_oil_film"
  | "wheel_cleaning"
  | "other";

export type WashProductUsage = {
  id?: string;
  productId?: string;
  name: string;
  category?: string;
  step?: string;
  amount?: string;
  purchasePrice?: number;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
  usedAmount?: number;
  usedUnit?: "ml" | "L" | "g" | "pcs";
  dilutionRatio?: string;
  estimatedCost?: number;
  cost?: number;
  note?: string;
};

export type WashProductPurchase = {
  id: string;
  date: string;
  purchasePrice?: number;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
  note?: string;
};

export type WashProduct = BaseEntity & {
  type?: "washProduct";
  userId: string;
  name: string;
  brand?: string;
  category: string;
  purchases: WashProductPurchase[];
  note?: string;
};

export type WashRecord = BaseEntity & {
  type?: "wash";
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  items: string[];
  minutes: number;
  cost: number;
  notes: string;
  washType?: WashType;
  shopName?: string;
  location?: string;
  laborCost?: number;
  materialCost?: number;
  waterElectricityCost?: number;
  locationCost?: number;
  products?: WashProductUsage[];
  effectRating?: 1 | 2 | 3 | 4 | 5;
  nextSuggestedDate?: string;
  imageIds?: string[];
};

export type ExpenseCategory =
  | "maintenance"
  | "repair"
  | "insurance"
  | "inspection"
  | "ticket"
  | "parking"
  | "etc"
  | "tire"
  | "battery"
  | "wiper"
  | "washer_fluid"
  | "accessory"
  | "other";

export type ExpenseRecord = BaseEntity & {
  type?: "expense";
  userId: string;
  vehicleId: string;
  date: string;
  odometer?: number;
  category: ExpenseCategory;
  title: string;
  amount: number;
  vendor?: string;
  paymentMethod?: PaymentMethod;
  nextDueDate?: string;
  nextDueOdometer?: number;
  note?: string;
  imageIds?: string[];
};

export type ChangeOperation = "create" | "update" | "delete";

export type ChangeSet = BaseEntity & {
  type?: "change";
  userId: string;
  entityType: EntityType;
  entityId: string;
  op: ChangeOperation;
  payload?: unknown;
  baseUpdatedAt?: number;
  changedAt: number;
  syncedAt?: number | null;
};

export type SyncState = {
  lastPulledAt?: number;
  lastPushedAt?: number;
  lastSyncAt?: number;
  pendingChanges: ChangeSet[];
  cloudEnabled: boolean;
  cloudUserId?: string;
};

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

export type FuelDateFilter = "all" | "month" | "year";

export type StoreCounts = {
  users: number;
  vehicles: number;
  fuelRecords: number;
  washRecords: number;
  washProducts: number;
  expenseRecords: number;
};

export type CarUtilsBackup = {
  app: "car-utils";
  schemaVersion: number;
  exportedAt: number;
  store: Store;
};

export type ImportOptions = {
  strategy: "prefer_newer" | "prefer_local" | "prefer_imported" | "manual";
  includeDeleted?: boolean;
  dryRun?: boolean;
};

export type ExportOptions = {
  scope: "all" | "current_user" | "current_vehicle";
  userId?: string;
  vehicleId?: string;
  includeDeleted?: boolean;
};

export type ImportConflict = {
  entityType: EntityType;
  id: string;
  localUpdatedAt?: number;
  incomingUpdatedAt?: number;
  reason: "local_newer" | "incoming_newer" | "same_id_different_content";
};

export type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
  conflicts: ImportConflict[];
  previewOnly: boolean;
};

export const STORAGE_KEY = "car-utils-store-v1";
export const DATA_SCHEMA_VERSION = 1;
export const DEVICE_ID_STORAGE_KEY = "car-utils-device-id";

export const vehiclePresets = [
  { brand: "Toyota", model: "Camry", energyType: "汽油" as EnergyType, tankSize: 60 },
  { brand: "Honda", model: "CR-V", energyType: "混动" as EnergyType, tankSize: 57 },
  { brand: "Tesla", model: "Model 3", energyType: "纯电" as EnergyType, batterySize: 60 },
  { brand: "BYD", model: "秦 PLUS DM-i", energyType: "混动" as EnergyType, tankSize: 48 },
  { brand: "Li Auto", model: "L7", energyType: "增程" as EnergyType, tankSize: 65, batterySize: 42 },
];

export const fuelGrades = ["92#", "95#", "98#", "爱跑98", "0#柴油", "其他"];

export const emptyStore: Store = {
  users: [],
  vehicles: [],
  fuelRecords: [],
  washRecords: [],
  washProducts: [],
  expenseRecords: [],
  schemaVersion: DATA_SCHEMA_VERSION,
  syncState: {
    pendingChanges: [],
    cloudEnabled: false,
  },
};

export function normalizeStore(value: unknown): Store {
  return migrateData(value);
}

export function migrateData(raw: unknown): Store {
  if (!raw || typeof raw !== "object") return createEmptyStore();

  const store = raw as Partial<Store>;
  const deviceId = typeof store.deviceId === "string" ? store.deviceId : getOrCreateDeviceId();
  const migratedAt = Date.now();

  const users = Array.isArray(store.users)
    ? store.users.map((user) => migrateUser(user, deviceId, migratedAt))
    : [];
  const userConsolidation = consolidateUsers(users);
  const vehicles = Array.isArray(store.vehicles)
    ? store.vehicles.map((vehicle) => migrateVehicle(vehicle, deviceId, migratedAt, userConsolidation.idMap))
    : [];
  const fuelRecords = Array.isArray(store.fuelRecords)
    ? store.fuelRecords.map((record) => migrateFuelRecord(record, deviceId, migratedAt, userConsolidation.idMap))
    : [];
  const washRecords = Array.isArray(store.washRecords)
    ? store.washRecords.map((record) => migrateWashRecord(record, deviceId, migratedAt, userConsolidation.idMap))
    : [];
  const washProducts = Array.isArray(store.washProducts)
    ? store.washProducts.map((product) => migrateWashProduct(product, deviceId, migratedAt, userConsolidation.idMap))
    : [];
  const expenseRecords = Array.isArray(store.expenseRecords)
    ? store.expenseRecords.map((record) => migrateExpenseRecord(record, deviceId, migratedAt, userConsolidation.idMap))
    : [];
  const mappedCurrentUserId =
    typeof store.currentUserId === "string" ? userConsolidation.idMap.get(store.currentUserId) ?? store.currentUserId : undefined;
  const currentUserId =
    mappedCurrentUserId && userConsolidation.users.some((user) => user.id === mappedCurrentUserId)
      ? mappedCurrentUserId
      : undefined;

  return {
    users: userConsolidation.users,
    vehicles,
    fuelRecords,
    washRecords,
    washProducts,
    expenseRecords,
    currentUserId,
    deviceId,
    schemaVersion: DATA_SCHEMA_VERSION,
    syncState: migrateSyncState(store.syncState, deviceId, migratedAt),
  };
}

export function createStoreBackup(store: Store): CarUtilsBackup {
  return {
    app: "car-utils",
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: Date.now(),
    store: normalizeStore(store),
  };
}

export function parseStoreBackup(text: string): Store {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份文件不是有效的 JSON 对象");
  }

  const candidate = parsed as Partial<CarUtilsBackup> & Partial<Store>;
  const storeValue = candidate.app === "car-utils" && candidate.store ? candidate.store : parsed;
  const store = normalizeStore(storeValue);
  const hasKnownShape =
    Array.isArray((storeValue as Partial<Store>).users) ||
    Array.isArray((storeValue as Partial<Store>).vehicles) ||
    Array.isArray((storeValue as Partial<Store>).fuelRecords) ||
    Array.isArray((storeValue as Partial<Store>).washRecords);

  if (!hasKnownShape) {
    throw new Error("没有识别到 Car Utils 数据");
  }

  return store;
}

export function countStoreItems(store: Store): StoreCounts {
  return {
    users: store.users.length,
    vehicles: store.vehicles.length,
    fuelRecords: store.fuelRecords.length,
    washRecords: store.washRecords.length,
    washProducts: store.washProducts.length,
    expenseRecords: store.expenseRecords.length,
  };
}

export function mergeStores(localStore: Store, incomingStore: Store): Store {
  const local = normalizeStore(localStore);
  const incoming = normalizeStore(incomingStore);
  const users = mergeEntities(local.users, incoming.users);
  const currentUserId = incoming.currentUserId ?? local.currentUserId;

  return {
    users,
    vehicles: mergeEntities(local.vehicles, incoming.vehicles),
    fuelRecords: mergeEntities(local.fuelRecords, incoming.fuelRecords),
    washRecords: mergeEntities(local.washRecords, incoming.washRecords),
    washProducts: mergeEntities(local.washProducts, incoming.washProducts),
    expenseRecords: mergeEntities(local.expenseRecords, incoming.expenseRecords),
    currentUserId: currentUserId && users.some((user) => user.id === currentUserId) ? currentUserId : users[0]?.id,
    deviceId: local.deviceId ?? incoming.deviceId ?? getOrCreateDeviceId(),
    schemaVersion: DATA_SCHEMA_VERSION,
    syncState: local.syncState ?? incoming.syncState ?? createEmptyStore().syncState,
  };
}

export function withCreatedTimestamps<T extends object>(
  entity: T,
  timestamp = Date.now(),
  source: EntitySource = "web",
) {
  return {
    ...entity,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deviceId: getOrCreateDeviceId(),
    source,
    schemaVersion: DATA_SCHEMA_VERSION,
  };
}

export function withUpdatedTimestamp<T extends object>(entity: T, timestamp = Date.now()) {
  return {
    ...entity,
    updatedAt: timestamp,
    deviceId: getOrCreateDeviceId(),
    schemaVersion: DATA_SCHEMA_VERSION,
  };
}

export function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isDeleted(entity: BaseEntity) {
  return typeof entity.deletedAt === "number" && entity.deletedAt > 0;
}

export function filterActive<T extends BaseEntity>(items: T[]) {
  return items.filter((item) => !isDeleted(item));
}

export function filterDeleted<T extends BaseEntity>(items: T[]) {
  return items.filter(isDeleted);
}

export function softDeleteEntity<T extends BaseEntity>(entity: T, timestamp = Date.now()) {
  return withUpdatedTimestamp({ ...entity, deletedAt: timestamp }, timestamp);
}

export function restoreEntity<T extends BaseEntity>(entity: T, timestamp = Date.now()) {
  return withUpdatedTimestamp({ ...entity, deletedAt: null }, timestamp);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function recordCost(record: FuelRecord) {
  return record.paidAmount ?? record.totalCost;
}

export function paidUnitPrice(record: FuelRecord) {
  if (record.volume <= 0) return record.pricePerUnit;
  return recordCost(record) / record.volume;
}

export function compactDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

export function stationName(record: FuelRecord) {
  return record.station.trim() || "未记录加油站";
}

export function fuzzyMatch(text: string, query: string) {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (normalizedText.includes(normalizedQuery)) return true;

  let cursor = 0;
  for (const char of normalizedQuery) {
    cursor = normalizedText.indexOf(char, cursor);
    if (cursor === -1) return false;
    cursor += 1;
  }

  return true;
}

export function matchesFuelDateFilter(record: FuelRecord, dateFilter: FuelDateFilter) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (dateFilter === "month") return record.date.startsWith(month);
  if (dateFilter === "year") return record.date.startsWith(year);
  return true;
}

export function matchesFuelQuery(record: FuelRecord, query: string) {
  const haystack = [
    record.station,
    record.fuelGrade,
    record.date,
    record.odometer,
    record.volume,
    record.pricePerUnit,
    record.paidAmount,
    record.totalCost,
  ]
    .filter((value) => value != null)
    .join(" ");

  return fuzzyMatch(haystack, query);
}

function createEmptyStore(): Store {
  return {
    ...emptyStore,
    deviceId: getOrCreateDeviceId(),
    syncState: {
      pendingChanges: [],
      cloudEnabled: false,
    },
  };
}

function migrateUser(value: User, deviceId: string, fallbackTime: number): User {
  const email = normalizeEmail(value.email);

  return {
    ...value,
    type: "user",
    name: value.name?.trim() || email.split("@")[0] || "车主",
    email,
    settings: value.settings ?? {
      distanceUnit: "km",
      currency: "CNY",
      fuelVolumeUnit: "L",
    },
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function migrateVehicle(value: Vehicle, deviceId: string, fallbackTime: number, userIdMap = new Map<string, string>()): Vehicle {
  return {
    ...value,
    type: "vehicle",
    userId: userIdMap.get(value.userId) ?? value.userId,
    nickname: value.nickname || value.model || "未命名车辆",
    brand: value.brand || "",
    model: value.model || "",
    year: value.year || "",
    plate: value.plate || "",
    energyType: value.energyType || "汽油",
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function migrateFuelRecord(value: FuelRecord, deviceId: string, fallbackTime: number, userIdMap = new Map<string, string>()): FuelRecord {
  const volume = normalizeNumber(value.volume, 0);
  const pricePerUnit = normalizeNumber(value.pricePerUnit, 0);

  return {
    ...value,
    type: "fuel",
    userId: userIdMap.get(value.userId) ?? value.userId,
    date: value.date || today(),
    volume,
    pricePerUnit,
    paidAmount: value.paidAmount == null ? undefined : normalizeNumber(value.paidAmount, 0),
    totalCost: normalizeNumber(value.totalCost, volume * pricePerUnit),
    station: value.station || "",
    fullTank: Boolean(value.fullTank),
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function migrateWashRecord(value: WashRecord, deviceId: string, fallbackTime: number, userIdMap = new Map<string, string>()): WashRecord {
  return {
    ...value,
    type: "wash",
    userId: userIdMap.get(value.userId) ?? value.userId,
    date: value.date || today(),
    odometer: normalizeNumber(value.odometer, 0),
    items: Array.isArray(value.items) ? value.items : [],
    minutes: normalizeNumber(value.minutes, 0),
    cost: normalizeNumber(value.cost, 0),
    notes: value.notes || "",
    washType: value.washType ?? "diy",
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function migrateWashProduct(value: WashProduct, deviceId: string, fallbackTime: number, userIdMap = new Map<string, string>()): WashProduct {
  return {
    ...value,
    type: "washProduct",
    userId: userIdMap.get(value.userId) ?? value.userId,
    name: value.name || "未命名耗材",
    category: value.category || "其他",
    purchases: Array.isArray(value.purchases)
      ? value.purchases.map((purchase) => ({
          id: purchase.id || makeFallbackId("wash_purchase"),
          date: purchase.date || today(),
          purchasePrice: purchase.purchasePrice == null ? undefined : normalizeNumber(purchase.purchasePrice, 0),
          capacity: purchase.capacity == null ? undefined : normalizeNumber(purchase.capacity, 0),
          capacityUnit: purchase.capacityUnit || "ml",
          note: purchase.note,
        }))
      : [],
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function migrateExpenseRecord(value: ExpenseRecord, deviceId: string, fallbackTime: number, userIdMap = new Map<string, string>()): ExpenseRecord {
  return {
    ...value,
    type: "expense",
    userId: userIdMap.get(value.userId) ?? value.userId,
    date: value.date || today(),
    category: value.category || "other",
    title: value.title || "车辆费用",
    amount: normalizeNumber(value.amount, 0),
    ...migrateEntityMetadata(value, deviceId, fallbackTime),
  };
}

function consolidateUsers(users: User[]) {
  const usersByEmail = new Map<string, User>();
  const idMap = new Map<string, string>();
  const anonymousUsers: User[] = [];

  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    if (!email) {
      anonymousUsers.push(user);
      idMap.set(user.id, user.id);
      return;
    }

    const existing = usersByEmail.get(email);
    if (!existing) {
      usersByEmail.set(email, { ...user, email });
      idMap.set(user.id, user.id);
      return;
    }

    const canonical = pickCanonicalUser(existing, user);
    const duplicate = canonical.id === existing.id ? user : existing;
    const merged = mergeUser(canonical, duplicate);

    usersByEmail.set(email, merged);
    idMap.set(existing.id, merged.id);
    idMap.set(user.id, merged.id);
  });

  return {
    users: [...usersByEmail.values(), ...anonymousUsers],
    idMap,
  };
}

function pickCanonicalUser(first: User, second: User) {
  const firstCreatedAt = first.createdAt ?? Number.MAX_SAFE_INTEGER;
  const secondCreatedAt = second.createdAt ?? Number.MAX_SAFE_INTEGER;
  return firstCreatedAt <= secondCreatedAt ? first : second;
}

function mergeUser(canonical: User, duplicate: User): User {
  const newer = getEntityTime(duplicate) > getEntityTime(canonical) ? duplicate : canonical;

  return {
    ...canonical,
    name: newer.name?.trim() || canonical.name,
    email: normalizeEmail(canonical.email || duplicate.email),
    openId: canonical.openId ?? duplicate.openId,
    unionId: canonical.unionId ?? duplicate.unionId,
    avatarUrl: newer.avatarUrl ?? canonical.avatarUrl,
    settings: newer.settings ?? canonical.settings,
    updatedAt: Math.max(canonical.updatedAt ?? 0, duplicate.updatedAt ?? 0),
    deletedAt: canonical.deletedAt ?? duplicate.deletedAt ?? null,
    deviceId: newer.deviceId ?? canonical.deviceId,
    source: newer.source ?? canonical.source,
    schemaVersion: DATA_SCHEMA_VERSION,
  };
}

function migrateSyncState(value: SyncState | undefined, deviceId: string, fallbackTime: number): SyncState {
  return {
    lastPulledAt: normalizeOptionalTime(value?.lastPulledAt),
    lastPushedAt: normalizeOptionalTime(value?.lastPushedAt),
    lastSyncAt: normalizeOptionalTime(value?.lastSyncAt),
    pendingChanges: Array.isArray(value?.pendingChanges)
      ? value.pendingChanges.map((change) => ({
          ...change,
          changedAt: normalizeTime(change.changedAt, fallbackTime),
          syncedAt: change.syncedAt == null ? null : normalizeTime(change.syncedAt, fallbackTime),
          ...migrateEntityMetadata(change, deviceId, fallbackTime),
        }))
      : [],
    cloudEnabled: Boolean(value?.cloudEnabled),
    cloudUserId: value?.cloudUserId,
  };
}

function migrateEntityMetadata<T extends BaseEntity>(entity: T, deviceId: string, fallbackTime: number): BaseEntity {
  const createdAt = normalizeTime(entity.createdAt, fallbackTime);
  const updatedAt = normalizeTime(entity.updatedAt, createdAt);

  return {
    id: entity.id || makeFallbackId("entity"),
    createdAt,
    updatedAt,
    deletedAt: entity.deletedAt == null ? null : normalizeTime(entity.deletedAt, updatedAt),
    deviceId: entity.deviceId || deviceId,
    source: entity.source || "migration",
    schemaVersion: DATA_SCHEMA_VERSION,
  };
}

function mergeEntities<T extends BaseEntity>(localItems: T[], incomingItems: T[]) {
  const merged = new Map<string, T>();

  localItems.forEach((item) => {
    if (item.id) merged.set(item.id, item);
  });

  incomingItems.forEach((item) => {
    if (!item.id) return;

    const existing = merged.get(item.id);
    if (!existing || getEntityTime(item) > getEntityTime(existing)) {
      merged.set(item.id, item);
    }
  });

  return [...merged.values()];
}

function getEntityTime(entity: BaseEntity) {
  const time = normalizeOptionalTime(entity.updatedAt ?? entity.createdAt) ?? 0;
  return Number.isFinite(time) ? time : 0;
}

function normalizeTime(value: unknown, fallback: number) {
  return normalizeOptionalTime(value) ?? fallback;
}

function normalizeOptionalTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getOrCreateDeviceId() {
  const fallbackId = makeFallbackId("web");

  if (typeof localStorage === "undefined") return fallbackId;

  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, fallbackId);
    return fallbackId;
  } catch {
    return fallbackId;
  }
}

function makeFallbackId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
