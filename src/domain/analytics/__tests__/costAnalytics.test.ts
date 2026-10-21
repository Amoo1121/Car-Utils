import { describe, expect, it } from "vitest";
import type { ExpenseRecord, FuelRecord, Vehicle, WashRecord } from "../../store/types";
import { monthlyCosts, periodStart, summarizeCosts } from "../costAnalytics";
import { buildTimeline, groupTimelineByMonth, timelineToCsv } from "../../timeline/timeline";
import { daysBetween, today } from "../../store/utils";

const vehicle: Vehicle = { id: "v1", userId: "u1", nickname: "车", brand: "", model: "", year: "", plate: "", energyType: "汽油" };

const fuelRecords: FuelRecord[] = [
  { id: "f1", userId: "u1", vehicleId: "v1", date: "2026-01-05", odometer: 1000, volume: 30, pricePerUnit: 8, totalCost: 240, paidAmount: 230, station: "中石化", fullTank: true },
  { id: "f2", userId: "u1", vehicleId: "v1", date: "2026-02-05", odometer: 1600, volume: 30, pricePerUnit: 8, totalCost: 240, station: "壳牌", fullTank: true },
  { id: "f3", userId: "u1", vehicleId: "v1", date: "2026-02-06", odometer: 1700, volume: 30, pricePerUnit: 8, totalCost: 240, station: "壳牌", fullTank: true, deletedAt: 1 },
];
const washRecords: WashRecord[] = [
  { id: "w1", userId: "u1", vehicleId: "v1", date: "2026-02-10", odometer: 0, items: ["正洗"], minutes: 30, cost: 20, notes: "", washType: "diy" },
];
const expenseRecords: ExpenseRecord[] = [
  { id: "e1", userId: "u1", vehicleId: "v1", date: "2026-02-20", category: "maintenance", title: "小保养", amount: 450, odometer: 1800 },
];
const all = { fuelRecords, washRecords, expenseRecords };

describe("cost analytics", () => {
  it("summarizes totals, distance and cost per km over a period", () => {
    const summary = summarizeCosts(vehicle, all, "all", "2026-02-28");
    expect(summary.fuel).toBe(470);
    expect(summary.wash).toBe(20);
    expect(summary.expense).toBe(450);
    expect(summary.total).toBe(940);
    expect(summary.distance).toBe(800); // 1000 → 1800, wash odometer 0 ignored
    expect(summary.costPerKm).toBeCloseTo(1.175);
    expect(summary.byExpenseCategory[0]).toMatchObject({ category: "maintenance", label: "保养", amount: 450 });
  });

  it("buckets costs by month", () => {
    const months = monthlyCosts(all, 3, "2026-02-28");
    expect(months.map((month) => month.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(months[1]).toMatchObject({ fuel: 230, total: 230 });
    expect(months[2]).toMatchObject({ fuel: 240, wash: 20, expense: 450, total: 710 });
  });

  it("computes period starts", () => {
    expect(periodStart("ytd", "2026-05-17")).toBe("2026-01-01");
    expect(periodStart("30d", "2026-03-01")).toBe("2026-01-31");
    expect(periodStart("12m", "2026-05-17")).toBe("2025-06-01");
  });
});

describe("timeline", () => {
  it("merges records newest first and hides deleted ones by default", () => {
    const entries = buildTimeline(all);
    expect(entries.map((entry) => entry.id)).toEqual(["e1", "w1", "f2", "f1"]);
    expect(buildTimeline(all, { deleted: true }).map((entry) => entry.id)).toEqual(["f3"]);
  });

  it("filters by kind and fuzzy query", () => {
    expect(buildTimeline(all, { kinds: ["fuel"] }).map((entry) => entry.id)).toEqual(["f2", "f1"]);
    expect(buildTimeline(all, { query: "壳牌" }).map((entry) => entry.id)).toEqual(["f2"]);
  });

  it("groups by month with totals", () => {
    const groups = groupTimelineByMonth(buildTimeline(all));
    expect(groups.map((group) => [group.month, group.total])).toEqual([
      ["2026-02", 710],
      ["2026-01", 230],
    ]);
  });

  it("exports CSV safely", () => {
    const csv = timelineToCsv(buildTimeline({ fuelRecords: [], washRecords: [], expenseRecords: [{ ...expenseRecords[0], title: "=HYPERLINK(1)" }] }));
    expect(csv.split("\n")[1]).toContain("'=HYPERLINK(1)");
  });
});

describe("date utils", () => {
  it("uses the local calendar date", () => {
    const local = new Date(2026, 0, 2, 0, 30);
    expect(today(local)).toBe("2026-01-02");
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
  });
});
