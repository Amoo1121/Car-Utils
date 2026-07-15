import type { FuelRecord } from "../store/types";

export type FuelStationSuggestion = {
  name: string;
  useCount: number;
  currentVehicleUseCount: number;
  lastUsedDate: string;
};

export type FuelStationSuggestionOptions = {
  vehicleId?: string;
  query?: string;
  limit?: number;
};

type StationAggregate = FuelStationSuggestion & {
  normalizedName: string;
};

export function buildFuelStationSuggestions(
  records: FuelRecord[],
  options: FuelStationSuggestionOptions = {},
): FuelStationSuggestion[] {
  const query = normalizeStationName(options.query ?? "").toLocaleLowerCase("zh-CN");
  const limit = Math.max(0, options.limit ?? 6);
  const stations = new Map<string, StationAggregate>();

  for (const record of records) {
    if (record.deletedAt != null) continue;

    const name = normalizeStationName(record.station);
    if (!name) continue;

    const normalizedName = name.toLocaleLowerCase("zh-CN");
    const existing = stations.get(normalizedName);
    const currentVehicleUseCount = record.vehicleId === options.vehicleId ? 1 : 0;

    if (!existing) {
      stations.set(normalizedName, {
        name,
        normalizedName,
        useCount: 1,
        currentVehicleUseCount,
        lastUsedDate: record.date,
      });
      continue;
    }

    existing.useCount += 1;
    existing.currentVehicleUseCount += currentVehicleUseCount;
    if (record.date > existing.lastUsedDate) {
      existing.name = name;
      existing.lastUsedDate = record.date;
    }
  }

  return [...stations.values()]
    .filter((station) => !query || station.normalizedName.includes(query))
    .sort((left, right) => {
      const matchDifference = matchRank(left.normalizedName, query) - matchRank(right.normalizedName, query);
      if (matchDifference !== 0) return matchDifference;

      const vehicleDifference = right.currentVehicleUseCount - left.currentVehicleUseCount;
      if (vehicleDifference !== 0) return vehicleDifference;

      const countDifference = right.useCount - left.useCount;
      if (countDifference !== 0) return countDifference;

      const dateDifference = right.lastUsedDate.localeCompare(left.lastUsedDate);
      if (dateDifference !== 0) return dateDifference;

      return left.name.localeCompare(right.name, "zh-CN");
    })
    .slice(0, limit)
    .map(({ normalizedName: _normalizedName, ...suggestion }) => suggestion);
}

function normalizeStationName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function matchRank(stationName: string, query: string) {
  if (!query || stationName === query) return 0;
  return stationName.startsWith(query) ? 1 : 2;
}
