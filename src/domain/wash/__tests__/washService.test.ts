import { describe, expect, it } from "vitest";
import type { Store, User, WashRecord } from "../../store/types";
import {
  addWashRecordToStore,
  buildWashRecord,
  createWashDraft,
  estimateWashProductCost,
  resolveWashCost,
  restoreWashRecordInStore,
  softDeleteWashRecordInStore,
  updateWashRecordInStore,
  type WashRecordDraft,
} from "../washService";

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

const baseWashRecord: WashRecord = {
  id: "wash_1",
  userId: "user_1",
  vehicleId: "vehicle_1",
  date: "2026-01-01",
  items: ["预洗", "正洗"],
  minutes: 30,
  cost: 20,
  notes: "旧记录",
  washType: "diy",
  createdAt: 100,
  updatedAt: 100,
  deletedAt: null,
};

const otherWashRecord: WashRecord = {
  ...baseWashRecord,
  id: "wash_2",
  userId: "user_2",
  notes: "其他用户",
};

describe("washService", () => {
  it("adds a wash record for the current user", () => {
    const nextStore = addWashRecordToStore(createStore(), currentUser, buildWashRecord("vehicle_1", createDraft()), {
      id: "wash_new",
      timestamp: 1000,
    });

    expect(nextStore?.washRecords).toHaveLength(3);
    expect(nextStore?.washRecords.at(-1)).toMatchObject({
      id: "wash_new",
      userId: "user_1",
      vehicleId: "vehicle_1",
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    });
  });

  it("updates only the current user's matching wash record", () => {
    const nextStore = updateWashRecordInStore(createStore(), currentUser, "wash_1", buildWashRecord("vehicle_1", createDraft()), {
      timestamp: 2000,
    });

    expect(nextStore?.washRecords.find((record) => record.id === "wash_1")).toMatchObject({
      notes: "新记录",
      cost: 37,
      createdAt: 100,
      updatedAt: 2000,
      deletedAt: null,
    });
    expect(nextStore?.washRecords.find((record) => record.id === "wash_2")).toMatchObject(otherWashRecord);
  });

  it("soft deletes and restores wash records", () => {
    const deletedStore = softDeleteWashRecordInStore(createStore(), currentUser, "wash_1", { timestamp: 3000 });
    const restoredStore = restoreWashRecordInStore(deletedStore!, currentUser, "wash_1", { timestamp: 4000 });

    expect(deletedStore?.washRecords.find((record) => record.id === "wash_1")).toMatchObject({
      deletedAt: 3000,
      updatedAt: 3000,
    });
    expect(restoredStore?.washRecords.find((record) => record.id === "wash_1")).toMatchObject({
      deletedAt: null,
      updatedAt: 4000,
    });
  });

  it("keeps DIY product cost estimation behavior", () => {
    const draft = createDraft();

    expect(estimateWashProductCost(draft.products[0])).toBe(12);
    expect(resolveWashCost(draft)).toBe(37);
    expect(buildWashRecord("vehicle_1", draft)).toMatchObject({
      materialCost: 12,
      cost: 37,
      products: [
        expect.objectContaining({
          name: "预洗液",
          estimatedCost: 12,
          cost: 12,
        }),
      ],
    });
  });

  it("creates drafts from existing wash records", () => {
    const draft = createWashDraft({
      ...baseWashRecord,
      odometer: 1234,
      products: [{ id: "usage_1", name: "正洗液", estimatedCost: 3 }],
    });

    expect(draft).toMatchObject({
      date: "2026-01-01",
      odometer: "1234",
      items: "预洗, 正洗",
      notes: "旧记录",
      products: [expect.objectContaining({ id: "usage_1", name: "正洗液", estimatedCost: "3" })],
    });
  });
});

function createStore(): Store {
  return {
    users: [currentUser, otherUser],
    vehicles: [],
    fuelRecords: [],
    washRecords: [baseWashRecord, otherWashRecord],
    washProducts: [],
    expenseRecords: [],
    currentUserId: currentUser.id,
    schemaVersion: 1,
  };
}

function createDraft(): WashRecordDraft {
  return {
    date: "2026-02-01",
    odometer: "",
    washType: "diy",
    shopName: "",
    location: "",
    items: "预洗, 正洗, 轮毂",
    minutes: "45",
    laborCost: "10",
    materialCost: "",
    waterElectricityCost: "5",
    locationCost: "10",
    cost: "",
    effectRating: "",
    nextSuggestedDate: "",
    notes: "新记录",
    products: [
      {
        id: "usage_1",
        productId: "",
        name: "预洗液",
        category: "预洗液",
        step: "预洗",
        purchasePrice: "120",
        capacity: "1000",
        capacityUnit: "ml",
        usedAmount: "100",
        usedUnit: "ml",
        dilutionRatio: "",
        estimatedCost: "",
        note: "",
      },
    ],
  };
}
