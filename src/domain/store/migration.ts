import { DATA_SCHEMA_VERSION, emptyStore } from "./constants";
import type {
  BaseEntity,
  CarUtilsBackup,
  ExpenseRecord,
  FuelRecord,
  Store,
  StoreCounts,
  SyncState,
  User,
  Vehicle,
  WashProduct,
  WashRecord,
} from "./types";
import {
  getEntityTime,
  getOrCreateDeviceId,
  makeFallbackId,
  normalizeEmail,
  normalizeNumber,
  normalizeOptionalTime,
  normalizeTime,
  today,
} from "./utils";

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

export function createEmptyStore(): Store {
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
