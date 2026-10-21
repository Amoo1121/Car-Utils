import type { FuelRecord, Store, User } from "../store/types";
import {
  makeFallbackId,
  restoreEntity,
  softDeleteEntity,
  today,
  withCreatedTimestamps,
  withUpdatedTimestamp,
} from "../store/utils";

export type FuelRecordInput = Omit<FuelRecord, "id" | "userId">;

export type FuelRecordDraft = {
  date: string;
  odometer: string;
  fuelGrade: string;
  customFuelGrade: string;
  volume: string;
  pricePerUnit: string;
  paidAmount: string;
  fuelLevelBefore: string;
  fuelLevelAfter: string;
  station: string;
  fullTank: boolean;
  note?: string;
};

export type FuelMutationOptions = {
  id?: string;
  timestamp?: number;
};

export function createEmptyFuelDraft(fuelGrade = "95#"): FuelRecordDraft {
  return {
    date: today(),
    odometer: "",
    fuelGrade,
    customFuelGrade: "",
    volume: "",
    pricePerUnit: "",
    paidAmount: "",
    fuelLevelBefore: "",
    fuelLevelAfter: "",
    station: "",
    fullTank: false,
  };
}

export function createFuelDraft(record: FuelRecord, fuelGrades: string[]): FuelRecordDraft {
  const knownFuelGrade = record.fuelGrade && fuelGrades.includes(record.fuelGrade);

  return {
    date: record.date,
    odometer: record.odometer != null ? String(record.odometer) : "",
    fuelGrade: knownFuelGrade ? record.fuelGrade! : record.fuelGrade ? "其他" : "95#",
    customFuelGrade: knownFuelGrade ? "" : record.fuelGrade ?? "",
    volume: String(record.volume),
    pricePerUnit: String(record.pricePerUnit),
    paidAmount: record.paidAmount != null ? String(record.paidAmount) : "",
    fuelLevelBefore: record.fuelLevelBefore != null ? String(record.fuelLevelBefore) : "",
    fuelLevelAfter: record.fuelLevelAfter != null ? String(record.fuelLevelAfter) : "",
    station: record.station,
    fullTank: record.fullTank,
    note: record.note ?? "",
  };
}

export function buildFuelRecord(vehicleOrRecord: string | Pick<FuelRecord, "vehicleId">, draft: FuelRecordDraft): FuelRecordInput {
  const vehicleId = typeof vehicleOrRecord === "string" ? vehicleOrRecord : vehicleOrRecord.vehicleId;
  const volume = Number(draft.volume);
  const pricePerUnit = Number(draft.pricePerUnit);
  const totalCost = volume * pricePerUnit;
  const fuelGrade = draft.fuelGrade === "其他" ? draft.customFuelGrade.trim() || "其他" : draft.fuelGrade;

  return {
    vehicleId,
    date: draft.date,
    odometer: draft.odometer ? Number(draft.odometer) : undefined,
    volume,
    pricePerUnit,
    fuelGrade,
    paidAmount: draft.paidAmount ? Number(draft.paidAmount) : undefined,
    fuelLevelBefore: draft.fuelLevelBefore ? Number(draft.fuelLevelBefore) : undefined,
    fuelLevelAfter: draft.fuelLevelAfter ? Number(draft.fuelLevelAfter) : undefined,
    totalCost,
    station: draft.station.trim(),
    fullTank: draft.fullTank,
    note: draft.note?.trim() || undefined,
  };
}

export type FuelDraftErrors = Partial<Record<keyof FuelRecordDraft, string>>;

export function validateFuelDraft(draft: FuelRecordDraft): FuelDraftErrors {
  const errors: FuelDraftErrors = {};
  const volume = Number(draft.volume);
  const price = Number(draft.pricePerUnit);
  if (!draft.date) errors.date = "请选择日期";
  if (!draft.volume.trim() || !Number.isFinite(volume) || volume <= 0) errors.volume = "请输入加注量";
  if (!draft.pricePerUnit.trim() || !Number.isFinite(price) || price <= 0) errors.pricePerUnit = "请输入单价";
  if (draft.paidAmount.trim() && !(Number(draft.paidAmount) >= 0)) errors.paidAmount = "金额无效";
  for (const key of ["fuelLevelBefore", "fuelLevelAfter"] as const) {
    const value = draft[key];
    if (value.trim() && !(Number(value) >= 0 && Number(value) <= 100)) errors[key] = "应在 0–100 之间";
  }
  if (draft.fuelLevelBefore.trim() && draft.fuelLevelAfter.trim() && Number(draft.fuelLevelAfter) < Number(draft.fuelLevelBefore)) {
    errors.fuelLevelAfter = "加注后应不低于加注前";
  }
  return errors;
}

export function resolveFuelDraftPaidAmount(draft: FuelRecordDraft) {
  const totalCost = Number(draft.volume) * Number(draft.pricePerUnit);
  return draft.paidAmount ? Number(draft.paidAmount) : totalCost;
}

export function addFuelRecordToStore(
  store: Store,
  currentUser: User | undefined,
  record: FuelRecordInput,
  options: FuelMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    fuelRecords: [
      ...store.fuelRecords,
      withCreatedTimestamps(
        {
          ...record,
          id: options.id ?? makeFallbackId("fuel"),
          userId: currentUser.id,
        },
        options.timestamp,
      ),
    ],
  };
}

export function updateFuelRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  record: FuelRecordInput,
  options: FuelMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    fuelRecords: store.fuelRecords.map((currentRecord) =>
      currentRecord.id === recordId && currentRecord.userId === currentUser.id
        ? withUpdatedTimestamp(
            {
              ...record,
              id: currentRecord.id,
              userId: currentRecord.userId,
              createdAt: currentRecord.createdAt,
              deletedAt: currentRecord.deletedAt,
            },
            options.timestamp,
          )
        : currentRecord,
    ),
  };
}

export function softDeleteFuelRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: FuelMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    fuelRecords: store.fuelRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? softDeleteEntity(record, options.timestamp) : record,
    ),
  };
}

export function restoreFuelRecordInStore(
  store: Store,
  currentUser: User | undefined,
  recordId: string,
  options: FuelMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    fuelRecords: store.fuelRecords.map((record) =>
      record.id === recordId && record.userId === currentUser.id ? restoreEntity(record, options.timestamp) : record,
    ),
  };
}
