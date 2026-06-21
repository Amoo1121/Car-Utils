export type EnergyType = "汽油" | "柴油" | "混动" | "纯电" | "增程";

export type EntityTimestamps = {
  createdAt?: string;
  updatedAt?: string;
};

export type User = EntityTimestamps & {
  id: string;
  name: string;
  email: string;
};

export type Vehicle = EntityTimestamps & {
  id: string;
  userId: string;
  nickname: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  energyType: EnergyType;
  tankSize?: number;
  batterySize?: number;
};

export type FuelRecord = EntityTimestamps & {
  id: string;
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
};

export type WashRecord = EntityTimestamps & {
  id: string;
  userId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  items: string[];
  minutes: number;
  cost: number;
  notes: string;
};

export type Store = {
  users: User[];
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  currentUserId?: string;
};

export type FuelDateFilter = "all" | "month" | "year";

export type StoreCounts = {
  users: number;
  vehicles: number;
  fuelRecords: number;
  washRecords: number;
};

export type CarUtilsBackup = {
  app: "car-utils";
  schemaVersion: number;
  exportedAt: string;
  store: Store;
};

type IdentifiedEntity = EntityTimestamps & {
  id: string;
};

export const STORAGE_KEY = "car-utils-store-v1";
export const DATA_SCHEMA_VERSION = 1;

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
};

export function normalizeStore(value: unknown): Store {
  if (!value || typeof value !== "object") return emptyStore;

  const store = value as Partial<Store>;

  return {
    users: Array.isArray(store.users) ? store.users : [],
    vehicles: Array.isArray(store.vehicles) ? store.vehicles : [],
    fuelRecords: Array.isArray(store.fuelRecords) ? store.fuelRecords : [],
    washRecords: Array.isArray(store.washRecords) ? store.washRecords : [],
    currentUserId: typeof store.currentUserId === "string" ? store.currentUserId : undefined,
  };
}

export function createStoreBackup(store: Store): CarUtilsBackup {
  return {
    app: "car-utils",
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
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
    currentUserId: currentUserId && users.some((user) => user.id === currentUserId) ? currentUserId : users[0]?.id,
  };
}

export function withCreatedTimestamps<T extends object>(entity: T, timestamp = new Date().toISOString()) {
  return { ...entity, createdAt: timestamp, updatedAt: timestamp };
}

export function withUpdatedTimestamp<T extends object>(entity: T, timestamp = new Date().toISOString()) {
  return { ...entity, updatedAt: timestamp };
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

function mergeEntities<T extends IdentifiedEntity>(localItems: T[], incomingItems: T[]) {
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

function getEntityTime(entity: EntityTimestamps) {
  const value = entity.updatedAt ?? entity.createdAt;
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}
