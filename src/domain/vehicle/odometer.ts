import type { ExpenseRecord, FuelRecord, Vehicle, WashRecord } from "../store/types";
import { daysBetween, isDeleted, today } from "../store/utils";

type OdometerSource = Pick<FuelRecord | WashRecord | ExpenseRecord, "id" | "date" | "odometer" | "deletedAt" | "vehicleId">;

export type OdometerReading = { date: string; odometer: number };

export type OdometerEstimate = {
  /** Highest reading we know of (vehicle profile or any record). */
  latest?: number;
  latestDate?: string;
  /** Average kilometres per day, based on readings at least 14 days apart. */
  dailyDistance?: number;
  /** Projection of today's odometer using the daily average. */
  estimatedToday?: number;
};

export function collectOdometerReadings(vehicle: Vehicle, sources: OdometerSource[]): OdometerReading[] {
  return sources
    .filter((item) => !isDeleted(item) && item.vehicleId === vehicle.id)
    .filter((item): item is OdometerSource & { odometer: number } => typeof item.odometer === "number" && item.odometer > 0)
    .map((item) => ({ date: item.date, odometer: item.odometer }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
}

export function estimateOdometer(vehicle: Vehicle, sources: OdometerSource[], now = today()): OdometerEstimate {
  const readings = collectOdometerReadings(vehicle, sources);
  const latestReading = readings.reduce<OdometerReading | undefined>(
    (best, reading) => (!best || reading.odometer > best.odometer ? reading : best),
    undefined,
  );
  const profile = vehicle.currentOdometer && vehicle.currentOdometer > 0 ? vehicle.currentOdometer : undefined;
  const latest = Math.max(latestReading?.odometer ?? 0, profile ?? 0) || undefined;
  const latestDate = latestReading && latestReading.odometer >= (profile ?? 0) ? latestReading.date : undefined;

  let dailyDistance: number | undefined;
  if (readings.length >= 2) {
    const first = readings[0];
    const last = readings.reduce((best, reading) => (reading.odometer > best.odometer ? reading : best), readings[0]);
    const days = daysBetween(first.date, last.date);
    const distance = last.odometer - first.odometer;
    if (days >= 14 && distance > 0) dailyDistance = distance / days;
  }

  const estimatedToday =
    latest && dailyDistance && latestDate ? latest + dailyDistance * Math.max(daysBetween(latestDate, now), 0) : latest;

  return { latest, latestDate, dailyDistance, estimatedToday };
}

/** Last odometer reading strictly before a date (used to validate new entries). */
export function previousOdometer(vehicle: Vehicle, sources: OdometerSource[], date: string, excludeOdometer?: number) {
  const readings = collectOdometerReadings(vehicle, sources).filter((reading) => reading.date <= date);
  const candidates = excludeOdometer == null ? readings : readings.filter((reading) => reading.odometer !== excludeOdometer);
  return candidates.reduce<number | undefined>((max, reading) => Math.max(max ?? 0, reading.odometer), undefined);
}
