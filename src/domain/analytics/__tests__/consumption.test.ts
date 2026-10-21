import { describe, expect, it } from "vitest";
import type { FuelRecord, Vehicle } from "../../store/types";
import { calculateConsumption, calculateFuelPriceStats } from "../consumption";

const vehicle: Vehicle = {
  id: "v1",
  userId: "u1",
  nickname: "测试车",
  brand: "T",
  model: "C",
  year: "2026",
  plate: "",
  energyType: "汽油",
  tankSize: 50,
};

let sequence = 0;
function fuel(overrides: Partial<FuelRecord>): FuelRecord {
  sequence += 1;
  return {
    id: `f${sequence}`,
    userId: "u1",
    vehicleId: "v1",
    date: "2026-01-01",
    volume: 30,
    pricePerUnit: 8,
    totalCost: 240,
    station: "S",
    fullTank: false,
    ...overrides,
  };
}

describe("calculateConsumption", () => {
  it("uses fuel gauge levels when the tank size is known", () => {
    const summary = calculateConsumption(vehicle, [
      fuel({ date: "2026-01-01", odometer: 1000, fuelLevelBefore: 20, fuelLevelAfter: 80 }),
      fuel({ date: "2026-01-10", odometer: 1400, fuelLevelBefore: 30, fuelLevelAfter: 90 }),
    ]);
    // 50 L × (80% − 30%) = 25 L over 400 km
    expect(summary.intervals).toHaveLength(1);
    expect(summary.intervals[0].method).toBe("gauge");
    expect(summary.average).toBeCloseTo(6.25, 5);
    expect(summary.unit).toBe("L");
  });

  it("falls back to the full-tank method and includes partial refuels in between", () => {
    const noTank = { ...vehicle, tankSize: undefined };
    const summary = calculateConsumption(noTank, [
      fuel({ date: "2026-01-01", odometer: 1000, fullTank: true, volume: 40 }),
      fuel({ date: "2026-01-05", odometer: 1200, volume: 10 }),
      fuel({ date: "2026-01-10", odometer: 1500, fullTank: true, volume: 25 }),
    ]);
    // (10 + 25) L over 500 km
    expect(summary.intervals).toHaveLength(1);
    expect(summary.intervals[0].method).toBe("full_tank");
    expect(summary.average).toBeCloseTo(7, 5);
  });

  it("ignores deleted records, other vehicles and implausible intervals", () => {
    const summary = calculateConsumption(vehicle, [
      fuel({ odometer: 1000, fuelLevelAfter: 100 }),
      fuel({ odometer: 1010, fuelLevelBefore: 10, deletedAt: 5 }),
      fuel({ odometer: 1010, fuelLevelBefore: 10, vehicleId: "other" }),
      fuel({ odometer: 1020, fuelLevelBefore: 10 }), // 45 L over 20 km — rejected
    ]);
    expect(summary.intervals).toHaveLength(0);
    expect(summary.confidence).toBe("none");
  });

  it("explains how to unlock consumption when the tank size is missing", () => {
    const summary = calculateConsumption({ ...vehicle, tankSize: undefined }, [
      fuel({ odometer: 1000, fuelLevelAfter: 80 }),
      fuel({ odometer: 1300, fuelLevelBefore: 30 }),
    ]);
    expect(summary.hint).toMatch(/油箱容量/);
  });

  it("uses battery size and kWh for electric vehicles", () => {
    const ev: Vehicle = { ...vehicle, energyType: "纯电", tankSize: undefined, batterySize: 60 };
    const summary = calculateConsumption(ev, [
      fuel({ odometer: 1000, fuelLevelAfter: 90 }),
      fuel({ odometer: 1200, fuelLevelBefore: 60 }),
    ]);
    expect(summary.unit).toBe("kWh");
    expect(summary.average).toBeCloseTo(9, 5);
  });
});

describe("calculateFuelPriceStats", () => {
  it("prefers the paid amount for unit prices", () => {
    const stats = calculateFuelPriceStats([
      fuel({ date: "2026-01-01", volume: 10, pricePerUnit: 8, totalCost: 80, paidAmount: 70 }),
      fuel({ date: "2026-02-01", volume: 10, pricePerUnit: 9, totalCost: 90 }),
    ]);
    expect(stats.latestUnitPrice).toBe(9);
    expect(stats.averageUnitPrice).toBe(8);
    expect(stats.totalCost).toBe(160);
  });
});
