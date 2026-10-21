import { describe, expect, it } from "vitest";
import type { ExpenseRecord, FuelRecord, Vehicle, WashRecord } from "../../store/types";
import { buildReminders } from "../reminders";

const vehicle: Vehicle = {
  id: "v1",
  userId: "u1",
  nickname: "车",
  brand: "",
  model: "",
  year: "",
  plate: "",
  energyType: "汽油",
  tankSize: 50,
};

function expense(overrides: Partial<ExpenseRecord>): ExpenseRecord {
  return {
    id: overrides.id ?? `e_${Math.random()}`,
    userId: "u1",
    vehicleId: "v1",
    date: "2026-01-01",
    category: "maintenance",
    title: "保养",
    amount: 500,
    ...overrides,
  };
}

function fuel(date: string, odometer: number): FuelRecord {
  return { id: `f_${date}`, userId: "u1", vehicleId: "v1", date, odometer, volume: 30, pricePerUnit: 8, totalCost: 240, station: "", fullTank: false };
}

const none = { fuelRecords: [] as FuelRecord[], washRecords: [] as WashRecord[] };

describe("buildReminders", () => {
  it("flags overdue and soon items by date", () => {
    const reminders = buildReminders({
      vehicle,
      ...none,
      expenseRecords: [
        expense({ id: "ins", category: "insurance", title: "交强险", nextDueDate: "2026-03-01" }),
        expense({ id: "insp", category: "inspection", title: "年检", nextDueDate: "2026-03-20" }),
        expense({ id: "far", category: "battery", title: "电瓶", nextDueDate: "2027-12-01" }),
      ],
      now: "2026-03-05",
    });
    expect(reminders.map((item) => [item.sourceId, item.severity])).toEqual([
      ["ins", "overdue"],
      ["insp", "soon"],
    ]);
  });

  it("only uses the newest record of a category so renewing clears the reminder", () => {
    const reminders = buildReminders({
      vehicle,
      ...none,
      expenseRecords: [
        expense({ id: "old", date: "2025-01-01", nextDueDate: "2026-01-01" }),
        expense({ id: "new", date: "2026-01-02", nextDueDate: "2027-01-02" }),
      ],
      now: "2026-01-10",
    });
    expect(reminders).toHaveLength(0);
  });

  it("projects odometer-based reminders from driving history", () => {
    const reminders = buildReminders({
      vehicle,
      fuelRecords: [fuel("2026-01-01", 10000), fuel("2026-01-31", 11500)], // 50 km/day
      washRecords: [],
      expenseRecords: [expense({ id: "m", date: "2026-01-01", odometer: 10000, nextDueOdometer: 12500 })],
      now: "2026-02-10", // ≈ 12000 km
    });
    expect(reminders[0].severity).toBe("soon");
    expect(reminders[0].kmLeft).toBe(500);
  });

  it("suggests adding tank size when gauge levels are recorded", () => {
    const reminders = buildReminders({
      vehicle: { ...vehicle, tankSize: undefined },
      fuelRecords: [{ ...fuel("2026-01-01", 1000), fuelLevelBefore: 20 }],
      washRecords: [],
      expenseRecords: [],
      now: "2026-01-02",
    });
    expect(reminders[0].id).toBe("setup:capacity");
  });
});
