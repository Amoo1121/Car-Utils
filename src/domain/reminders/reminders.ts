import { expenseCategoryMeta } from "../expense/expenseService";
import type { ExpenseRecord, FuelRecord, Vehicle, WashRecord } from "../store/types";
import { daysBetween, isDeleted, today } from "../store/utils";
import { estimateOdometer } from "../vehicle/odometer";

export type ReminderSeverity = "overdue" | "soon" | "upcoming";

export type Reminder = {
  id: string;
  kind: "expense" | "wash" | "setup";
  severity: ReminderSeverity;
  title: string;
  detail: string;
  dueDate?: string;
  dueOdometer?: number;
  daysLeft?: number;
  kmLeft?: number;
  /** Record that produced the reminder, so the UI can open or renew it. */
  sourceId?: string;
  category?: ExpenseRecord["category"];
};

export type ReminderInput = {
  vehicle: Vehicle;
  fuelRecords: FuelRecord[];
  washRecords: WashRecord[];
  expenseRecords: ExpenseRecord[];
  now?: string;
};

const SOON_DAYS = 30;
const SOON_KM = 1000;
const UPCOMING_DAYS = 90;
const UPCOMING_KM = 3000;

export function buildReminders({ vehicle, fuelRecords, washRecords, expenseRecords, now = today() }: ReminderInput): Reminder[] {
  const odometer = estimateOdometer(vehicle, [...fuelRecords, ...washRecords, ...expenseRecords], now);
  const currentKm = odometer.estimatedToday ?? odometer.latest;
  const reminders: Reminder[] = [];

  // Only the newest record of each kind decides the next due point; renewing supersedes the old reminder.
  const latestByKey = new Map<string, ExpenseRecord>();
  expenseRecords
    .filter((record) => !isDeleted(record) && record.vehicleId === vehicle.id)
    .forEach((record) => {
      const key = record.category === "other" || record.category === "repair" ? `${record.category}:${record.title}` : record.category;
      const existing = latestByKey.get(key);
      if (!existing || record.date > existing.date || (record.date === existing.date && (record.createdAt ?? 0) > (existing.createdAt ?? 0))) {
        latestByKey.set(key, record);
      }
    });

  latestByKey.forEach((record) => {
    if (!record.nextDueDate && !record.nextDueOdometer) return;
    const daysLeft = record.nextDueDate ? daysBetween(now, record.nextDueDate) : undefined;
    const kmLeft = record.nextDueOdometer && currentKm ? Math.round(record.nextDueOdometer - currentKm) : undefined;
    const severity = severityFor(daysLeft, kmLeft);
    if (!severity) return;

    const label = record.title || expenseCategoryMeta(record.category).label;
    reminders.push({
      id: `expense:${record.id}`,
      kind: "expense",
      severity,
      title: label,
      detail: describeDue(daysLeft, kmLeft, record),
      dueDate: record.nextDueDate,
      dueOdometer: record.nextDueOdometer,
      daysLeft,
      kmLeft,
      sourceId: record.id,
      category: record.category,
    });
  });

  const latestWash = washRecords
    .filter((record) => !isDeleted(record) && record.vehicleId === vehicle.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestWash?.nextSuggestedDate) {
    const daysLeft = daysBetween(now, latestWash.nextSuggestedDate);
    const severity = daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "soon" : daysLeft <= 30 ? "upcoming" : null;
    if (severity) {
      reminders.push({
        id: `wash:${latestWash.id}`,
        kind: "wash",
        severity,
        title: "洗车",
        detail: daysLeft < 0 ? `已过建议日期 ${-daysLeft} 天` : daysLeft === 0 ? "建议今天洗车" : `${daysLeft} 天后`,
        dueDate: latestWash.nextSuggestedDate,
        daysLeft,
        sourceId: latestWash.id,
      });
    }
  }

  const activeFuel = fuelRecords.filter((record) => !isDeleted(record) && record.vehicleId === vehicle.id);
  const usesGauge = activeFuel.some((record) => record.fuelLevelBefore != null || record.fuelLevelAfter != null);
  const capacity = vehicle.energyType === "纯电" ? vehicle.batterySize : vehicle.tankSize;
  if (usesGauge && !(capacity && capacity > 0)) {
    reminders.push({
      id: "setup:capacity",
      kind: "setup",
      severity: "upcoming",
      title: vehicle.energyType === "纯电" ? "补充电池容量" : "补充油箱容量",
      detail: "你记录了油表刻度，填写容量后就能算出真实油耗。",
    });
  }

  const order: Record<ReminderSeverity, number> = { overdue: 0, soon: 1, upcoming: 2 };
  return reminders.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER) ||
      (a.kmLeft ?? Number.MAX_SAFE_INTEGER) - (b.kmLeft ?? Number.MAX_SAFE_INTEGER),
  );
}

function severityFor(daysLeft: number | undefined, kmLeft: number | undefined): ReminderSeverity | null {
  if ((daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0)) return "overdue";
  if ((daysLeft != null && daysLeft <= SOON_DAYS) || (kmLeft != null && kmLeft <= SOON_KM)) return "soon";
  if ((daysLeft != null && daysLeft <= UPCOMING_DAYS) || (kmLeft != null && kmLeft <= UPCOMING_KM)) return "upcoming";
  return null;
}

function describeDue(daysLeft: number | undefined, kmLeft: number | undefined, record: ExpenseRecord) {
  const parts: string[] = [];
  if (daysLeft != null) {
    parts.push(daysLeft < 0 ? `已过期 ${-daysLeft} 天` : daysLeft === 0 ? "今天到期" : `${daysLeft} 天后（${record.nextDueDate}）`);
  }
  if (kmLeft != null) {
    parts.push(kmLeft < 0 ? `已超 ${Math.abs(kmLeft).toLocaleString("zh-CN")} km` : `还剩约 ${kmLeft.toLocaleString("zh-CN")} km`);
  } else if (record.nextDueOdometer) {
    parts.push(`${record.nextDueOdometer.toLocaleString("zh-CN")} km 时`);
  }
  return parts.join(" · ");
}
