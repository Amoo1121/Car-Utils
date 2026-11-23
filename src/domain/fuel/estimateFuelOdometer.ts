import { calculateConsumption } from "../analytics/consumption";
import type { FuelRecord, Vehicle } from "../store/types";
import { isDeleted } from "../store/utils";

/** Estimate from the last refuel, using only consumption intervals before this entry. */
export function estimateFuelOdometer(
  vehicle: Vehicle,
  records: FuelRecord[],
  date: string,
  levelBefore: number | undefined,
  excludeId?: string,
) {
  const capacity = vehicle.energyType === "纯电" ? vehicle.batterySize : vehicle.tankSize;
  if (!capacity || !Number.isFinite(capacity) || capacity <= 0) return undefined;
  if (levelBefore == null || !Number.isFinite(levelBefore) || levelBefore < 0 || levelBefore > 100) return undefined;

  const history = records
    .filter((record) => !isDeleted(record) && record.vehicleId === vehicle.id && record.id !== excludeId && record.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const previous = history.at(-1);
  // A missing reading on the most recent refuel cannot be bridged without its fuel balance.
  // Date-only records cannot establish the order of two refuels on the same day.
  if (!previous || previous.date === date || previous.odometer == null || !Number.isFinite(previous.odometer) || previous.odometer <= 0) return undefined;
  const after = previous.fuelLevelAfter ?? (previous.fullTank ? 100 : undefined);
  if (after == null || !Number.isFinite(after) || after > 100 || after < levelBefore) return undefined;
  const summary = calculateConsumption(vehicle, history);
  const per100km = summary.recent;
  if (!Number.isFinite(per100km) || per100km <= 0) return undefined;
  const consumed = capacity * (after - levelBefore) / 100;
  const distance = consumed / per100km * 100;
  return { odometer: previous.odometer + distance, distance, per100km, unit: summary.unit };
}
