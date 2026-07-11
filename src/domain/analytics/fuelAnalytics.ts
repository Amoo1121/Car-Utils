import type { FuelRecord, Vehicle } from "../store/types";
import { compactDate, isDeleted, paidUnitPrice, recordCost, stationName } from "../store/utils";

export type ChartPoint = {
  label: string;
  value: number;
};

export type FuelOverviewStats = {
  fuelCost: number;
  fuelVolume: number;
  distance: number;
  avgConsumption: number;
};

export type StationSummary = {
  station: string;
  recordCount: number;
  avgUnitPrice: number;
  totalVolume: number;
};

export type StationPerformance = StationSummary & {
  grade: string;
  intervals: number;
  avgKmPerLiter: number;
  avgConsumption: number;
  relativeToAverage: number;
};

export type FuelInsights = {
  pricePoints: ChartPoint[];
  costPoints: ChartPoint[];
  stationSummaries: StationSummary[];
  stationPerformances: StationPerformance[];
  canCompareStations: boolean;
  hasTankSize: boolean;
  validIntervalCount: number;
  overallKmPerLiter: number;
};

export function calculateFuelOverview(fuelRecords: FuelRecord[]): FuelOverviewStats {
  const activeRecords = fuelRecords.filter((record) => !isDeleted(record));
  const fuelCost = activeRecords.reduce((sum, record) => sum + recordCost(record), 0);
  const fuelVolume = activeRecords.reduce((sum, record) => sum + record.volume, 0);
  const recordsWithOdometer = activeRecords.filter((record) => typeof record.odometer === "number");
  const consumptionVolume = recordsWithOdometer.reduce((sum, record) => sum + record.volume, 0);
  const sortedFuel = [...recordsWithOdometer].sort((a, b) => a.odometer! - b.odometer!);
  const distance =
    sortedFuel.length >= 2 ? sortedFuel[sortedFuel.length - 1].odometer! - sortedFuel[0].odometer! : 0;

  // TODO: replace this legacy estimate with confidence-aware interval calculations in a later phase.
  const avgConsumption = distance > 0 ? (consumptionVolume / distance) * 100 : 0;

  return { fuelCost, fuelVolume, distance, avgConsumption };
}

export function calculateFuelInsights(vehicle: Vehicle, fuelRecords: FuelRecord[]): FuelInsights {
  const ordered = fuelRecords
    .filter((record) => !isDeleted(record))
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = ordered.slice(-12);
  const pricePoints = recent.map((record) => ({
    label: compactDate(record.date),
    value: paidUnitPrice(record),
  }));
  const costPoints = recent.map((record) => ({
    label: compactDate(record.date),
    value: recordCost(record),
  }));

  const stationSummaryMap = new Map<string, { count: number; unitPriceTotal: number; volume: number }>();
  const qualitySummaryMap = new Map<string, { count: number; unitPriceTotal: number; volume: number }>();
  ordered.forEach((record) => {
    const station = stationName(record);
    const grade = record.fuelGrade || "未记录油品";
    const qualityKey = `${station}__${grade}`;
    const current = stationSummaryMap.get(station) ?? { count: 0, unitPriceTotal: 0, volume: 0 };
    current.count += 1;
    current.unitPriceTotal += paidUnitPrice(record);
    current.volume += record.volume;
    stationSummaryMap.set(station, current);

    const currentQuality = qualitySummaryMap.get(qualityKey) ?? { count: 0, unitPriceTotal: 0, volume: 0 };
    currentQuality.count += 1;
    currentQuality.unitPriceTotal += paidUnitPrice(record);
    currentQuality.volume += record.volume;
    qualitySummaryMap.set(qualityKey, currentQuality);
  });

  const stationSummaries: StationSummary[] = [...stationSummaryMap.entries()]
    .map(([station, summary]) => ({
      station,
      recordCount: summary.count,
      avgUnitPrice: summary.unitPriceTotal / summary.count,
      totalVolume: summary.volume,
    }))
    .sort((a, b) => b.recordCount - a.recordCount || a.avgUnitPrice - b.avgUnitPrice);

  const tankSize =
    vehicle.energyType !== "纯电" && vehicle.tankSize && vehicle.tankSize > 0 ? vehicle.tankSize : undefined;
  const recordsWithOdometer = ordered
    .filter((record) => typeof record.odometer === "number")
    .sort((a, b) => a.odometer! - b.odometer!);
  const performanceMap = new Map<string, { intervals: number; distanceTotal: number; consumedTotal: number }>();

  if (tankSize) {
    for (let index = 1; index < recordsWithOdometer.length; index += 1) {
      const previous = recordsWithOdometer[index - 1];
      const current = recordsWithOdometer[index];
      const previousStation = previous.station.trim();
      const previousGrade = previous.fuelGrade || "未记录油品";
      const distance = current.odometer! - previous.odometer!;
      const hasFuelLevels = previous.fuelLevelAfter != null && current.fuelLevelBefore != null;

      if (!previousStation || !hasFuelLevels || distance <= 0) continue;

      // TODO: this intentionally preserves the current fuel-level interval estimate and thresholds.
      const consumedVolume = tankSize * ((previous.fuelLevelAfter! - current.fuelLevelBefore!) / 100);
      const consumption = (consumedVolume / distance) * 100;

      if (consumedVolume <= 0 || consumption < 2 || consumption > 30) continue;

      const station = stationName(previous);
      const qualityKey = `${station}__${previousGrade}`;
      const currentPerformance = performanceMap.get(qualityKey) ?? {
        intervals: 0,
        distanceTotal: 0,
        consumedTotal: 0,
      };
      currentPerformance.intervals += 1;
      currentPerformance.distanceTotal += distance;
      currentPerformance.consumedTotal += consumedVolume;
      performanceMap.set(qualityKey, currentPerformance);
    }
  }

  const overallDistance = [...performanceMap.values()].reduce((sum, performance) => sum + performance.distanceTotal, 0);
  const overallConsumed = [...performanceMap.values()].reduce((sum, performance) => sum + performance.consumedTotal, 0);
  const overallKmPerLiter = overallConsumed > 0 ? overallDistance / overallConsumed : 0;
  const stationPerformances: StationPerformance[] = [...performanceMap.entries()]
    .map(([qualityKey, performance]) => {
      const [station, grade] = qualityKey.split("__");
      const summary = qualitySummaryMap.get(qualityKey);
      const avgKmPerLiter = performance.distanceTotal / performance.consumedTotal;
      const avgConsumption = (performance.consumedTotal / performance.distanceTotal) * 100;
      return {
        station,
        grade,
        intervals: performance.intervals,
        avgKmPerLiter,
        avgConsumption,
        relativeToAverage: overallKmPerLiter > 0 ? (avgKmPerLiter / overallKmPerLiter - 1) * 100 : 0,
        recordCount: summary?.count ?? 0,
        avgUnitPrice: summary ? summary.unitPriceTotal / summary.count : 0,
        totalVolume: summary?.volume ?? 0,
      };
    })
    .filter((item) => item.intervals >= 2)
    .sort((a, b) => b.avgKmPerLiter - a.avgKmPerLiter);

  return {
    pricePoints,
    costPoints,
    stationSummaries,
    stationPerformances,
    canCompareStations: stationPerformances.length >= 2,
    hasTankSize: Boolean(tankSize),
    validIntervalCount: [...performanceMap.values()].reduce((sum, item) => sum + item.intervals, 0),
    overallKmPerLiter,
  };
}
