import { describe, expect, it } from "vitest";
import type { FuelRecord, Vehicle } from "../../store/types";
import { calculateFuelInsights, calculateFuelOverview } from "../fuelAnalytics";

const vehicle: Vehicle = {
  id: "vehicle_1",
  userId: "user_1",
  nickname: "测试车",
  brand: "Test",
  model: "Car",
  year: "2026",
  plate: "",
  energyType: "汽油",
  tankSize: 60,
};

describe("fuelAnalytics", () => {
  it("returns zeroed analytics for empty data", () => {
    expect(calculateFuelOverview([])).toEqual({
      fuelCost: 0,
      fuelVolume: 0,
      distance: 0,
      avgConsumption: 0,
    });
    expect(calculateFuelInsights(vehicle, [])).toMatchObject({
      pricePoints: [],
      costPoints: [],
      stationSummaries: [],
      stationPerformances: [],
      canCompareStations: false,
      validIntervalCount: 0,
      overallKmPerLiter: 0,
    });
  });

  it("returns one trend point for a single record", () => {
    const insights = calculateFuelInsights(vehicle, [createFuelRecord({ id: "fuel_1", date: "2026-01-02" })]);

    expect(insights.pricePoints).toEqual([{ label: "1/2", value: 8 }]);
    expect(insights.costPoints).toEqual([{ label: "1/2", value: 160 }]);
  });

  it("sorts multi-record trends by date and keeps only the latest 12 points", () => {
    const records = Array.from({ length: 14 }, (_, index) =>
      createFuelRecord({
        id: `fuel_${index}`,
        date: `2026-01-${String(14 - index).padStart(2, "0")}`,
        pricePerUnit: index + 1,
        totalCost: 20 * (index + 1),
      }),
    );

    const insights = calculateFuelInsights(vehicle, records);

    expect(insights.pricePoints).toHaveLength(12);
    expect(insights.pricePoints[0].label).toBe("1/3");
    expect(insights.pricePoints.at(-1)?.label).toBe("1/14");
  });

  it("aggregates stations using paid unit price and volume", () => {
    const insights = calculateFuelInsights(vehicle, [
      createFuelRecord({ id: "fuel_1", station: "中石化", volume: 20, paidAmount: 150 }),
      createFuelRecord({ id: "fuel_2", station: "中石化", volume: 30, paidAmount: 240 }),
      createFuelRecord({ id: "fuel_3", station: "中石油", volume: 10, paidAmount: 90 }),
    ]);

    expect(insights.stationSummaries[0]).toMatchObject({
      station: "中石化",
      recordCount: 2,
      totalVolume: 50,
      avgUnitPrice: 7.75,
    });
  });

  it("preserves the current fuel endurance interval calculation", () => {
    const insights = calculateFuelInsights(vehicle, [
      createFuelRecord({
        id: "fuel_1",
        date: "2026-01-01",
        station: "中石化",
        fuelGrade: "95#",
        odometer: 1000,
        fuelLevelAfter: 80,
      }),
      createFuelRecord({
        id: "fuel_2",
        date: "2026-01-02",
        station: "中石化",
        fuelGrade: "95#",
        odometer: 1100,
        fuelLevelBefore: 60,
        fuelLevelAfter: 80,
      }),
      createFuelRecord({
        id: "fuel_3",
        date: "2026-01-03",
        station: "中石油",
        fuelGrade: "92#",
        odometer: 1200,
        fuelLevelBefore: 60,
      }),
    ]);

    expect(insights.validIntervalCount).toBe(2);
    expect(insights.stationPerformances).toHaveLength(1);
    expect(insights.stationPerformances[0]).toMatchObject({
      station: "中石化",
      grade: "95#",
      intervals: 2,
      avgKmPerLiter: 200 / 24,
      avgConsumption: 12,
    });
  });

  it("excludes soft-deleted records from overview and insights", () => {
    const active = createFuelRecord({ id: "fuel_active", station: "正常站" });
    const deleted = createFuelRecord({
      id: "fuel_deleted",
      station: "已删除站",
      volume: 100,
      totalCost: 1000,
      deletedAt: 123,
    });

    expect(calculateFuelOverview([active, deleted])).toMatchObject({ fuelCost: 160, fuelVolume: 20 });
    expect(calculateFuelInsights(vehicle, [active, deleted]).stationSummaries.map((item) => item.station)).toEqual([
      "正常站",
    ]);
  });
});

function createFuelRecord(overrides: Partial<FuelRecord> = {}): FuelRecord {
  return {
    id: "fuel_default",
    userId: "user_1",
    vehicleId: "vehicle_1",
    date: "2026-01-01",
    volume: 20,
    pricePerUnit: 8,
    totalCost: 160,
    station: "中石化",
    fullTank: false,
    deletedAt: null,
    ...overrides,
  };
}
