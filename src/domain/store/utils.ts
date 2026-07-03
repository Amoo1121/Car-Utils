import { DATA_SCHEMA_VERSION, DEVICE_ID_STORAGE_KEY } from "./constants";
import type { BaseEntity, EntitySource, FuelDateFilter, FuelRecord } from "./types";

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

export function getEntityTime(entity: BaseEntity) {
  const time = normalizeOptionalTime(entity.updatedAt ?? entity.createdAt) ?? 0;
  return Number.isFinite(time) ? time : 0;
}

export function normalizeTime(value: unknown, fallback: number) {
  return normalizeOptionalTime(value) ?? fallback;
}

export function normalizeOptionalTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function getOrCreateDeviceId() {
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

export function makeFallbackId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
