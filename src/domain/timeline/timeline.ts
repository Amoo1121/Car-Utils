import { expenseCategoryMeta } from "../expense/expenseService";
import type { ExpenseRecord, FuelRecord, WashRecord, WashType } from "../store/types";
import { fuzzyMatch, isDeleted, paidUnitPrice, recordCost } from "../store/utils";

export type TimelineKind = "fuel" | "wash" | "expense";

export type TimelineEntry =
  | { kind: "fuel"; id: string; date: string; amount: number; title: string; subtitle: string; odometer?: number; deleted: boolean; sortKey: number; record: FuelRecord }
  | { kind: "wash"; id: string; date: string; amount: number; title: string; subtitle: string; odometer?: number; deleted: boolean; sortKey: number; record: WashRecord }
  | { kind: "expense"; id: string; date: string; amount: number; title: string; subtitle: string; odometer?: number; deleted: boolean; sortKey: number; record: ExpenseRecord };

export type TimelineMonth = {
  month: string;
  total: number;
  entries: TimelineEntry[];
};

export const washTypeLabels: Record<WashType, string> = {
  diy: "DIY 洗车",
  shop_basic: "店内普洗",
  shop_detailing: "店内精洗",
  machine: "机器洗车",
  detailing: "精洗",
  wax: "打蜡",
  interior: "内饰清洁",
  glass_oil_film: "玻璃去油膜",
  wheel_cleaning: "轮毂清洁",
  other: "其他洗护",
};

export function washTitle(record: WashRecord) {
  return washTypeLabels[record.washType ?? "diy"] ?? "洗车";
}

function validOdometer(value: number | undefined) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

export function fuelEntry(record: FuelRecord): TimelineEntry {
  const parts = [`${formatNumber(record.volume, 2)} L`, `¥${formatNumber(paidUnitPrice(record), 2)}/L`];
  if (record.station.trim()) parts.unshift(record.station.trim());
  return {
    kind: "fuel",
    id: record.id,
    date: record.date,
    amount: recordCost(record),
    title: `加油 · ${record.fuelGrade || "未记录油品"}`,
    subtitle: parts.join(" · "),
    odometer: validOdometer(record.odometer),
    deleted: isDeleted(record),
    sortKey: record.createdAt ?? 0,
    record,
  };
}

export function washEntry(record: WashRecord): TimelineEntry {
  const parts: string[] = [];
  if (record.shopName) parts.push(record.shopName);
  if (record.items.length) parts.push(record.items.join("、"));
  if (record.products?.length) parts.push(`${record.products.length} 种耗材`);
  if (record.effectRating) parts.push("★".repeat(record.effectRating));
  return {
    kind: "wash",
    id: record.id,
    date: record.date,
    amount: record.cost || 0,
    title: washTitle(record),
    subtitle: parts.join(" · ") || "洗车",
    odometer: validOdometer(record.odometer),
    deleted: isDeleted(record),
    sortKey: record.createdAt ?? 0,
    record,
  };
}

export function expenseEntry(record: ExpenseRecord): TimelineEntry {
  const meta = expenseCategoryMeta(record.category);
  const parts: string[] = [meta.label];
  if (record.vendor) parts.push(record.vendor);
  if (record.nextDueDate) parts.push(`下次 ${record.nextDueDate}`);
  return {
    kind: "expense",
    id: record.id,
    date: record.date,
    amount: record.amount || 0,
    title: record.title || meta.label,
    subtitle: parts.join(" · "),
    odometer: validOdometer(record.odometer),
    deleted: isDeleted(record),
    sortKey: record.createdAt ?? 0,
    record,
  };
}

export type TimelineFilter = {
  kinds?: TimelineKind[];
  query?: string;
  deleted?: boolean;
};

export function buildTimeline(
  records: { fuelRecords: FuelRecord[]; washRecords: WashRecord[]; expenseRecords: ExpenseRecord[] },
  filter: TimelineFilter = {},
): TimelineEntry[] {
  const kinds = new Set(filter.kinds?.length ? filter.kinds : ["fuel", "wash", "expense"]);
  const wantDeleted = Boolean(filter.deleted);
  const entries: TimelineEntry[] = [
    ...(kinds.has("fuel") ? records.fuelRecords.map(fuelEntry) : []),
    ...(kinds.has("wash") ? records.washRecords.map(washEntry) : []),
    ...(kinds.has("expense") ? records.expenseRecords.map(expenseEntry) : []),
  ];
  const query = filter.query?.trim() ?? "";

  return entries
    .filter((entry) => entry.deleted === wantDeleted)
    .filter((entry) => !query || fuzzyMatch(searchText(entry), query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.sortKey - a.sortKey);
}

export function groupTimelineByMonth(entries: TimelineEntry[]): TimelineMonth[] {
  const months = new Map<string, TimelineMonth>();
  entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    const bucket = months.get(month) ?? { month, total: 0, entries: [] };
    bucket.total += entry.amount;
    bucket.entries.push(entry);
    months.set(month, bucket);
  });
  return [...months.values()];
}

function searchText(entry: TimelineEntry) {
  const base = [entry.title, entry.subtitle, entry.date, entry.amount.toFixed(2), entry.odometer ?? ""];
  if (entry.kind === "wash") base.push(entry.record.notes, ...(entry.record.products ?? []).map((product) => product.name));
  if (entry.kind === "expense") base.push(entry.record.note ?? "");
  if (entry.kind === "fuel") base.push(entry.record.note ?? "");
  return base.join(" ");
}

function formatNumber(value: number, digits: number) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : "-";
}

const csvHeader = ["类型", "日期", "标题", "说明", "金额", "里程"];

export function timelineToCsv(entries: TimelineEntry[]) {
  const kindLabel: Record<TimelineKind, string> = { fuel: "加油", wash: "洗车", expense: "费用" };
  const rows = entries.map((entry) => [
    kindLabel[entry.kind],
    entry.date,
    entry.title,
    entry.subtitle,
    entry.amount.toFixed(2),
    entry.odometer != null ? String(entry.odometer) : "",
  ]);
  return [csvHeader, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string) {
  // Prevent spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
