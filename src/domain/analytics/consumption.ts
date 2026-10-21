import type { FuelRecord, Vehicle } from "../store/types";
import { isDeleted, paidUnitPrice, recordCost } from "../store/utils";

export type ConsumptionMethod = "gauge" | "full_tank";

export type ConsumptionInterval = {
  fromRecordId: string;
  toRecordId: string;
  fromDate: string;
  toDate: string;
  distance: number;
  consumed: number;
  /** L/100km (or kWh/100km for EVs). */
  per100km: number;
  costPerKm: number;
  method: ConsumptionMethod;
  fuelGrade?: string;
  station?: string;
};

export type ConsumptionSummary = {
  intervals: ConsumptionInterval[];
  /** Distance-weighted average over all valid intervals. 0 when unknown. */
  average: number;
  /** Average of the most recent intervals (up to 3). */
  recent: number;
  best?: ConsumptionInterval;
  worst?: ConsumptionInterval;
  totalDistance: number;
  confidence: "none" | "low" | "medium" | "high";
  unit: "L" | "kWh";
  /** Explains why consumption cannot be computed yet. */
  hint?: string;
};

const MIN_PER_100KM = 1.5;
const MAX_PER_100KM = 35;

export function energyUnit(vehicle: Pick<Vehicle, "energyType">): "L" | "kWh" {
  return vehicle.energyType === "纯电" ? "kWh" : "L";
}

function capacityOf(vehicle: Vehicle) {
  const capacity = vehicle.energyType === "纯电" ? vehicle.batterySize : vehicle.tankSize;
  return capacity && capacity > 0 ? capacity : undefined;
}

function hasOdometer(record: FuelRecord) {
  return typeof record.odometer === "number" && record.odometer > 0;
}

/**
 * Computes real-world consumption between refuels.
 *
 * Two independent methods are supported so that both common logging styles work:
 * - gauge: tank capacity × (level after previous refuel − level before this refuel)
 * - full_tank: classic "fill to full" — volume added at the closing full-tank refuel
 *   plus all partial refuels in between, divided by distance since the previous full tank.
 */
export function calculateConsumption(vehicle: Vehicle, fuelRecords: FuelRecord[]): ConsumptionSummary {
  const unit = energyUnit(vehicle);
  const capacity = capacityOf(vehicle);
  const ordered = fuelRecords
    .filter((record) => !isDeleted(record) && record.vehicleId === vehicle.id && hasOdometer(record))
    .sort((a, b) => a.odometer! - b.odometer! || a.date.localeCompare(b.date));

  const intervals: ConsumptionInterval[] = [];
  const coveredUntil = new Set<string>();

  // Gauge method: requires capacity and recorded levels on both ends.
  if (capacity) {
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const levelAfter = previous.fuelLevelAfter ?? (previous.fullTank ? 100 : undefined);
      const levelBefore = current.fuelLevelBefore;
      if (levelAfter == null || levelBefore == null) continue;

      const distance = current.odometer! - previous.odometer!;
      const consumed = capacity * ((levelAfter - levelBefore) / 100);
      const interval = buildInterval(previous, current, distance, consumed, "gauge");
      if (interval) {
        intervals.push(interval);
        coveredUntil.add(current.id);
      }
    }
  }

  // Full-tank method for stretches the gauge method could not cover.
  let anchorIndex = -1;
  for (let index = 0; index < ordered.length; index += 1) {
    const record = ordered[index];
    if (!record.fullTank) continue;

    if (anchorIndex >= 0) {
      const anchor = ordered[anchorIndex];
      const stretch = ordered.slice(anchorIndex + 1, index + 1);
      const alreadyCovered = stretch.every((item) => coveredUntil.has(item.id));
      if (!alreadyCovered) {
        const consumed = stretch.reduce((sum, item) => sum + item.volume, 0);
        const distance = record.odometer! - anchor.odometer!;
        const interval = buildInterval(anchor, record, distance, consumed, "full_tank");
        if (interval) intervals.push(interval);
      }
    }
    anchorIndex = index;
  }

  intervals.sort((a, b) => a.toDate.localeCompare(b.toDate) || a.distance - b.distance);
  const totalDistance = intervals.reduce((sum, interval) => sum + interval.distance, 0);
  const totalConsumed = intervals.reduce((sum, interval) => sum + interval.consumed, 0);
  const average = totalDistance > 0 ? (totalConsumed / totalDistance) * 100 : 0;
  const recentIntervals = intervals.slice(-3);
  const recentDistance = recentIntervals.reduce((sum, interval) => sum + interval.distance, 0);
  const recentConsumed = recentIntervals.reduce((sum, interval) => sum + interval.consumed, 0);
  const sortedByValue = [...intervals].sort((a, b) => a.per100km - b.per100km);

  return {
    intervals,
    average,
    recent: recentDistance > 0 ? (recentConsumed / recentDistance) * 100 : 0,
    best: sortedByValue[0],
    worst: sortedByValue.at(-1),
    totalDistance,
    confidence: confidenceFor(intervals.length, totalDistance),
    unit,
    hint: intervals.length > 0 ? undefined : explainMissingConsumption(vehicle, ordered, capacity),
  };
}

function buildInterval(
  from: FuelRecord,
  to: FuelRecord,
  distance: number,
  consumed: number,
  method: ConsumptionMethod,
): ConsumptionInterval | null {
  if (distance <= 0 || consumed <= 0) return null;
  const per100km = (consumed / distance) * 100;
  if (per100km < MIN_PER_100KM || per100km > MAX_PER_100KM) return null;

  return {
    fromRecordId: from.id,
    toRecordId: to.id,
    fromDate: from.date,
    toDate: to.date,
    distance,
    consumed,
    per100km,
    costPerKm: (consumed * paidUnitPrice(from)) / distance,
    method,
    fuelGrade: from.fuelGrade,
    station: from.station.trim() || undefined,
  };
}

function confidenceFor(count: number, distance: number): ConsumptionSummary["confidence"] {
  if (count === 0) return "none";
  if (count >= 6 && distance >= 1500) return "high";
  if (count >= 3 && distance >= 500) return "medium";
  return "low";
}

function explainMissingConsumption(vehicle: Vehicle, ordered: FuelRecord[], capacity: number | undefined) {
  if (ordered.length < 2) return "至少需要两笔带里程的补能记录。";
  const hasLevels = ordered.some((record) => record.fuelLevelBefore != null || record.fuelLevelAfter != null);
  const fullTankCount = ordered.filter((record) => record.fullTank).length;
  if (hasLevels && !capacity) {
    return vehicle.energyType === "纯电" ? "填写电池容量后即可按电量估算能耗。" : "填写油箱容量后即可按油表刻度估算油耗。";
  }
  if (fullTankCount < 2) return "记录油表刻度，或连续两次勾选“加满”，即可计算真实油耗。";
  return "现有记录的里程或油量不合理，暂时无法估算。";
}

export type FuelPriceStats = {
  latestUnitPrice?: number;
  averageUnitPrice: number;
  totalCost: number;
  totalVolume: number;
};

export function calculateFuelPriceStats(fuelRecords: FuelRecord[]): FuelPriceStats {
  const active = fuelRecords.filter((record) => !isDeleted(record));
  const totalCost = active.reduce((sum, record) => sum + recordCost(record), 0);
  const totalVolume = active.reduce((sum, record) => sum + record.volume, 0);
  const latest = [...active].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];

  return {
    latestUnitPrice: latest ? paidUnitPrice(latest) : undefined,
    averageUnitPrice: totalVolume > 0 ? totalCost / totalVolume : 0,
    totalCost,
    totalVolume,
  };
}
