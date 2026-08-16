import { describe, expect, it } from "vitest";
import { matchesFuelDateFilter } from "../utils";
import type { FuelRecord } from "../types";

function fuelRecord(date: string): FuelRecord {
  return {
    id: `fuel_${date}`,
    userId: "user_1",
    vehicleId: "vehicle_1",
    date,
    volume: 10,
    pricePerUnit: 8,
    totalCost: 80,
    station: "Test",
    fullTank: false,
  };
}

describe("matchesFuelDateFilter", () => {
  it("supports an inclusive custom date range", () => {
    expect(matchesFuelDateFilter(fuelRecord("2026-02-01"), "custom", "2026-02-01", "2026-02-28")).toBe(true);
    expect(matchesFuelDateFilter(fuelRecord("2026-02-28"), "custom", "2026-02-01", "2026-02-28")).toBe(true);
    expect(matchesFuelDateFilter(fuelRecord("2026-03-01"), "custom", "2026-02-01", "2026-02-28")).toBe(false);
  });

  it("allows an open-ended custom range", () => {
    expect(matchesFuelDateFilter(fuelRecord("2026-03-01"), "custom", "2026-02-01")).toBe(true);
    expect(matchesFuelDateFilter(fuelRecord("2026-01-01"), "custom", "2026-02-01")).toBe(false);
    expect(matchesFuelDateFilter(fuelRecord("2026-01-01"), "custom", "", "2026-02-01")).toBe(true);
  });
});
