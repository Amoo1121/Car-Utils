import { describe, expect, it } from "vitest";
import type { FuelRecord, Vehicle } from "../../store/types";
import { estimateFuelOdometer } from "../estimateFuelOdometer";

const vehicle: Vehicle = { id: "v1", userId: "u1", nickname: "Car", brand: "", model: "", year: "", plate: "", energyType: "汽油", tankSize: 50 };
const first: FuelRecord = { id: "f1", userId: "u1", vehicleId: "v1", date: "2026-11-01", odometer: 1000, fuelLevelAfter: 80, volume: 30, pricePerUnit: 8, totalCost: 240, station: "S", fullTank: false };
const second: FuelRecord = { ...first, id: "f2", date: "2026-11-10", odometer: 1500, fuelLevelBefore: 20, fuelLevelAfter: 80 };
const history = [first, second];

describe("estimateFuelOdometer", () => {
  it("recalculates from the current pre-refuel level and historical consumption", () => {
    // 30 L / 500 km = 6 L/100km; current tank consumed 15 L or 30 L.
    expect(estimateFuelOdometer(vehicle, history, "2026-11-23", 50)).toMatchObject({ odometer: 1750, per100km: 6 });
    expect(estimateFuelOdometer(vehicle, history, "2026-11-23", 20)).toMatchObject({ odometer: 2000, per100km: 6 });
  });

  it("excludes the record being edited, future records, deleted entries and other vehicles", () => {
    const records = [
      ...history,
      { ...second, id: "edit", date: "2026-11-23", odometer: 2100 },
      { ...second, id: "future", date: "2026-11-25", odometer: 3000 },
      { ...second, id: "deleted", date: "2026-11-21", deletedAt: 1 },
      { ...second, id: "other", date: "2026-11-22", vehicleId: "other" },
    ];
    expect(estimateFuelOdometer(vehicle, records, "2026-11-23", 50, "edit")?.odometer).toBe(1750);
    expect(estimateFuelOdometer(vehicle, records, "2026-11-05", 50)).toBeUndefined();
  });

  it("does not skip an intermediate refuel with no odometer", () => {
    const records = [...history, { ...second, id: "missing", date: "2026-11-20", odometer: undefined }];
    expect(estimateFuelOdometer(vehicle, records, "2026-11-23", 20)).toBeUndefined();
  });

  it("does not guess the order of same-day refuels", () => {
    expect(estimateFuelOdometer(vehicle, history, "2026-11-10", 20)).toBeUndefined();
  });

  it.each([undefined, -1, 101, NaN, Infinity, 90])("withholds a fuel-based estimate for invalid or incompatible level %s", (level) => {
    expect(estimateFuelOdometer(vehicle, history, "2026-11-23", level)).toBeUndefined();
  });

  it("requires historical consumption and a known tank capacity", () => {
    expect(estimateFuelOdometer(vehicle, [second], "2026-11-23", 20)).toBeUndefined();
    expect(estimateFuelOdometer({ ...vehicle, tankSize: undefined }, history, "2026-11-23", 20)).toBeUndefined();
  });

  it("supports full-tank anchors and electric battery capacity", () => {
    const full = { ...second, fuelLevelAfter: undefined, fullTank: true };
    expect(estimateFuelOdometer(vehicle, [first, full], "2026-11-23", 40)?.odometer).toBe(2000);
    expect(estimateFuelOdometer({ ...vehicle, energyType: "纯电", batterySize: 75 }, history, "2026-11-23", 20)).toMatchObject({ odometer: 2000, per100km: 9, unit: "kWh" });
  });
});
