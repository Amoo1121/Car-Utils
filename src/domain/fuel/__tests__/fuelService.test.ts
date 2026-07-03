import { describe, expect, it } from "vitest";
import type { FuelRecord, Store, User } from "../../store/types";
import {
  addFuelRecordToStore,
  buildFuelRecord,
  createFuelDraft,
  restoreFuelRecordInStore,
  softDeleteFuelRecordInStore,
  updateFuelRecordInStore,
  type FuelRecordDraft,
} from "../fuelService";

const currentUser: User = {
  id: "user_1",
  name: "Amoo",
  email: "amoo@example.com",
};

const otherUser: User = {
  id: "user_2",
  name: "Other",
  email: "other@example.com",
};

const baseFuelRecord: FuelRecord = {
  id: "fuel_1",
  userId: "user_1",
  vehicleId: "vehicle_1",
  date: "2026-01-01",
  odometer: 1000,
  volume: 20,
  pricePerUnit: 8,
  fuelGrade: "95#",
  paidAmount: 150,
  totalCost: 160,
  station: "中石化",
  fullTank: false,
  createdAt: 100,
  updatedAt: 100,
  deletedAt: null,
};

const otherFuelRecord: FuelRecord = {
  ...baseFuelRecord,
  id: "fuel_2",
  userId: "user_2",
  station: "其他用户",
};

describe("fuelService", () => {
  it("adds a fuel record for the current user", () => {
    const store = createStore();
    const nextStore = addFuelRecordToStore(store, currentUser, buildFuelInput(), {
      id: "fuel_new",
      timestamp: 1000,
    });

    expect(nextStore?.fuelRecords).toHaveLength(3);
    expect(nextStore?.fuelRecords.at(-1)).toMatchObject({
      id: "fuel_new",
      userId: "user_1",
      vehicleId: "vehicle_1",
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    });
  });

  it("updates only the current user's matching fuel record", () => {
    const nextStore = updateFuelRecordInStore(createStore(), currentUser, "fuel_1", buildFuelInput({ station: "更新后" }), {
      timestamp: 2000,
    });

    expect(nextStore?.fuelRecords.find((record) => record.id === "fuel_1")).toMatchObject({
      station: "更新后",
      createdAt: 100,
      updatedAt: 2000,
      deletedAt: null,
    });
    expect(nextStore?.fuelRecords.find((record) => record.id === "fuel_2")).toMatchObject(otherFuelRecord);
  });

  it("soft deletes and restores with the same deletedAt semantics", () => {
    const deletedStore = softDeleteFuelRecordInStore(createStore(), currentUser, "fuel_1", { timestamp: 3000 });
    const restoredStore = restoreFuelRecordInStore(deletedStore!, currentUser, "fuel_1", { timestamp: 4000 });

    expect(deletedStore?.fuelRecords.find((record) => record.id === "fuel_1")).toMatchObject({
      deletedAt: 3000,
      updatedAt: 3000,
    });
    expect(restoredStore?.fuelRecords.find((record) => record.id === "fuel_1")).toMatchObject({
      deletedAt: null,
      updatedAt: 4000,
    });
  });

  it("builds custom fuel grade records from drafts", () => {
    const draft: FuelRecordDraft = {
      date: "2026-02-01",
      odometer: "1234.5",
      fuelGrade: "其他",
      customFuelGrade: "爱跑98",
      volume: "30",
      pricePerUnit: "9",
      paidAmount: "260",
      fuelLevelBefore: "20",
      fuelLevelAfter: "80",
      station: "中石化",
      fullTank: true,
    };

    expect(buildFuelRecord("vehicle_1", draft)).toMatchObject({
      vehicleId: "vehicle_1",
      odometer: 1234.5,
      fuelGrade: "爱跑98",
      volume: 30,
      pricePerUnit: 9,
      paidAmount: 260,
      totalCost: 270,
      fuelLevelBefore: 20,
      fuelLevelAfter: 80,
      fullTank: true,
    });
  });

  it("creates edit drafts and maps unknown fuel grades to custom", () => {
    const draft = createFuelDraft({ ...baseFuelRecord, fuelGrade: "爱跑98" }, ["92#", "95#", "98#"]);

    expect(draft).toMatchObject({
      fuelGrade: "其他",
      customFuelGrade: "爱跑98",
      volume: "20",
      paidAmount: "150",
    });
  });
});

function createStore(): Store {
  return {
    users: [currentUser, otherUser],
    vehicles: [],
    fuelRecords: [baseFuelRecord, otherFuelRecord],
    washRecords: [],
    washProducts: [],
    expenseRecords: [],
    currentUserId: currentUser.id,
    schemaVersion: 1,
  };
}

function buildFuelInput(overrides: Partial<Omit<FuelRecord, "id" | "userId">> = {}) {
  return {
    vehicleId: "vehicle_1",
    date: "2026-02-01",
    volume: 30,
    pricePerUnit: 8,
    totalCost: 240,
    station: "中石油",
    fullTank: true,
    ...overrides,
  };
}
