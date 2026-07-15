import { describe, expect, it } from "vitest";
import type { FuelRecord } from "../../store/types";
import { buildFuelStationSuggestions } from "../stationSuggestions";

describe("buildFuelStationSuggestions", () => {
  it("deduplicates normalized names and ignores blank or deleted records", () => {
    const suggestions = buildFuelStationSuggestions([
      createRecord("1", "中国石化 人民路站", "2026-01-01"),
      createRecord("2", "  中国石化   人民路站  ", "2026-02-01"),
      createRecord("3", "", "2026-03-01"),
      { ...createRecord("4", "已删除加油站", "2026-04-01"), deletedAt: 10 },
    ]);

    expect(suggestions).toEqual([
      {
        name: "中国石化 人民路站",
        useCount: 2,
        currentVehicleUseCount: 0,
        lastUsedDate: "2026-02-01",
      },
    ]);
  });

  it("prioritizes current-vehicle stations, then frequency and recency", () => {
    const suggestions = buildFuelStationSuggestions(
      [
        createRecord("1", "本车常用站", "2026-01-01", "vehicle_1"),
        createRecord("2", "其他车高频站", "2026-01-02", "vehicle_2"),
        createRecord("3", "其他车高频站", "2026-02-02", "vehicle_2"),
        createRecord("4", "其他车高频站", "2026-03-02", "vehicle_2"),
        createRecord("5", "其他车新站", "2026-04-02", "vehicle_2"),
      ],
      { vehicleId: "vehicle_1" },
    );

    expect(suggestions.map((station) => station.name)).toEqual(["本车常用站", "其他车高频站", "其他车新站"]);
  });

  it("ranks exact and prefix matches before contains matches", () => {
    const suggestions = buildFuelStationSuggestions(
      [
        createRecord("1", "城北中国石化", "2026-03-01"),
        createRecord("2", "中国石化人民路站", "2026-01-01"),
        createRecord("3", "中国石化", "2026-02-01"),
      ],
      { query: "中国石化" },
    );

    expect(suggestions.map((station) => station.name)).toEqual(["中国石化", "中国石化人民路站", "城北中国石化"]);
  });

  it("limits the number of returned suggestions", () => {
    const records = Array.from({ length: 10 }, (_, index) =>
      createRecord(String(index), `加油站 ${index}`, `2026-01-${String(index + 1).padStart(2, "0")}`),
    );

    expect(buildFuelStationSuggestions(records, { limit: 4 })).toHaveLength(4);
  });
});

function createRecord(id: string, station: string, date: string, vehicleId = "vehicle_2"): FuelRecord {
  return {
    id,
    userId: "user_1",
    vehicleId,
    date,
    volume: 20,
    pricePerUnit: 8,
    totalCost: 160,
    station,
    fullTank: false,
    deletedAt: null,
  };
}
