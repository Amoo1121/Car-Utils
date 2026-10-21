import { expenseCategoryMeta } from "../expense/expenseService";
import type { ExpenseRecord, FuelRecord, Vehicle, WashRecord } from "../store/types";
import { isDeleted, recordCost, today } from "../store/utils";
import { collectOdometerReadings } from "../vehicle/odometer";

export type CostCategory = "fuel" | "wash" | "expense";

export type MonthlyCost = {
  month: string; // YYYY-MM
  fuel: number;
  wash: number;
  expense: number;
  total: number;
};

export type CostPeriod = "30d" | "90d" | "ytd" | "12m" | "all";

export const costPeriodLabels: Record<CostPeriod, string> = {
  "30d": "近 30 天",
  "90d": "近 90 天",
  ytd: "今年",
  "12m": "近 12 个月",
  all: "全部",
};

export type CostRecords = {
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  expenseRecords: ExpenseRecord[];
};

export type CostSummary = {
  total: number;
  fuel: number;
  wash: number;
  expense: number;
  recordCount: number;
  distance: number;
  costPerKm: number;
  byExpenseCategory: { category: ExpenseRecord["category"]; label: string; amount: number; count: number }[];
};

export function periodStart(period: CostPeriod, now = today()) {
  const date = new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1, Number(now.slice(8, 10)));
  if (period === "all") return "";
  if (period === "ytd") return `${now.slice(0, 4)}-01-01`;
  if (period === "30d") date.setDate(date.getDate() - 29);
  if (period === "90d") date.setDate(date.getDate() - 89);
  if (period === "12m") {
    date.setMonth(date.getMonth() - 11);
    date.setDate(1);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterByPeriod<T extends { date: string }>(items: T[], period: CostPeriod, now = today()) {
  const start = periodStart(period, now);
  return items.filter((item) => item.date >= start && item.date <= now);
}

export function summarizeCosts(vehicle: Vehicle, records: CostRecords, period: CostPeriod, now = today()): CostSummary {
  const fuel = filterByPeriod(records.fuelRecords.filter((record) => !isDeleted(record)), period, now);
  const wash = filterByPeriod(records.washRecords.filter((record) => !isDeleted(record)), period, now);
  const expense = filterByPeriod(records.expenseRecords.filter((record) => !isDeleted(record)), period, now);

  const fuelTotal = fuel.reduce((sum, record) => sum + recordCost(record), 0);
  const washTotal = wash.reduce((sum, record) => sum + (record.cost || 0), 0);
  const expenseTotal = expense.reduce((sum, record) => sum + (record.amount || 0), 0);
  const total = fuelTotal + washTotal + expenseTotal;

  // Distance within the period, from all odometer readings (fuel, wash and expense records).
  const readings = collectOdometerReadings(vehicle, [
    ...records.fuelRecords,
    ...records.washRecords,
    ...records.expenseRecords,
  ]);
  const start = periodStart(period, now);
  const before = readings.filter((reading) => reading.date < start).at(-1);
  const inside = readings.filter((reading) => reading.date >= start && reading.date <= now);
  const startKm = before?.odometer ?? inside[0]?.odometer;
  const endKm = inside.reduce<number | undefined>((max, reading) => Math.max(max ?? 0, reading.odometer), undefined);
  const distance = startKm != null && endKm != null && endKm > startKm ? endKm - startKm : 0;

  const categories = new Map<ExpenseRecord["category"], { amount: number; count: number }>();
  expense.forEach((record) => {
    const current = categories.get(record.category) ?? { amount: 0, count: 0 };
    current.amount += record.amount || 0;
    current.count += 1;
    categories.set(record.category, current);
  });

  return {
    total,
    fuel: fuelTotal,
    wash: washTotal,
    expense: expenseTotal,
    recordCount: fuel.length + wash.length + expense.length,
    distance,
    costPerKm: distance > 0 ? total / distance : 0,
    byExpenseCategory: [...categories.entries()]
      .map(([category, value]) => ({ category, label: expenseCategoryMeta(category).label, ...value }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function monthlyCosts(records: CostRecords, months = 12, now = today()): MonthlyCost[] {
  const result: MonthlyCost[] = [];
  const year = Number(now.slice(0, 4));
  const month = Number(now.slice(5, 7)) - 1;
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - offset, 1);
    result.push({
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      fuel: 0,
      wash: 0,
      expense: 0,
      total: 0,
    });
  }
  const index = new Map(result.map((item) => [item.month, item]));
  const add = (date: string, key: CostCategory, amount: number) => {
    const bucket = index.get(date.slice(0, 7));
    if (!bucket || !Number.isFinite(amount)) return;
    bucket[key] += amount;
    bucket.total += amount;
  };
  records.fuelRecords.filter((record) => !isDeleted(record)).forEach((record) => add(record.date, "fuel", recordCost(record)));
  records.washRecords.filter((record) => !isDeleted(record)).forEach((record) => add(record.date, "wash", record.cost || 0));
  records.expenseRecords.filter((record) => !isDeleted(record)).forEach((record) => add(record.date, "expense", record.amount || 0));
  return result;
}
