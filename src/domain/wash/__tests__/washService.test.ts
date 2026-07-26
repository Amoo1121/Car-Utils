import { describe, expect, it } from "vitest";
import type { Store, User, WashRecord } from "../../store/types";
import {
  addWashRecordToStore,
  buildWashRecord,
  changeWashDraftType,
  createEmptyWashDraft,
  createWashDraft,
  estimateWashProductCost,
  getDefaultWashStepForProductCategory,
  getSuggestedWashUsageUnit,
  resolveWashCost,
  resolveWashProductUsageCost,
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

  it("uses current product details instead of a stale material total", () => {
    const draft = createDraft();
    draft.materialCost = "99";
    draft.cost = "99";

    expect(resolveWashCost(draft)).toBe(37);
    expect(buildWashRecord("vehicle_1", draft)).toMatchObject({
      cost: 37,
      materialCost: 12,
    });
  });

  it("recalculates an edited history record after another product is added", () => {
    const draft = createWashDraft({
      ...baseWashRecord,
      cost: 17,
      materialCost: 12,
      waterElectricityCost: 5,
      products: [
        {
          id: "usage_old",
          name: "预洗液",
          purchasePrice: 120,
          capacity: 1000,
          capacityUnit: "ml",
          usedAmount: 100,
          usedUnit: "ml",
          estimatedCost: 12,
        },
      ],
    });
    draft.products.unshift({
      ...draft.products[0],
      id: "usage_new",
      name: "正洗液",
      purchasePrice: "80",
      capacity: "1000",
      usedAmount: "50",
      estimatedCost: "",
    });

    expect(resolveWashCost(draft)).toBe(21);
    expect(buildWashRecord("vehicle_1", draft)).toMatchObject({
      cost: 21,
      materialCost: 16,
      products: [
        expect.objectContaining({ id: "usage_new", estimatedCost: 4 }),
        expect.objectContaining({ id: "usage_old", estimatedCost: 12 }),
      ],
    });
  });

  it("uses a manually entered product cost in summaries and saved records", () => {
    const draft = createDraft();
    draft.products[0].estimatedCost = "7.5";

    expect(resolveWashProductUsageCost(draft.products[0])).toBe(7.5);
    expect(resolveWashCost(draft)).toBe(32.5);
    expect(buildWashRecord("vehicle_1", draft)).toMatchObject({
      cost: 32.5,
      materialCost: 7.5,
      products: [expect.objectContaining({ estimatedCost: 7.5, cost: 7.5 })],
    });
  });

  it("keeps a legacy total when no itemized DIY cost is available", () => {
    const draft = createEmptyWashDraft();
    draft.cost = "28";

    expect(draft.products).toEqual([]);
    expect(resolveWashCost(draft)).toBe(28);

    draft.waterElectricityCost = "15";
    expect(resolveWashCost(draft)).toBe(15);
  });

  it("uses only the paid total for shop washes", () => {
    const draft = createDraft();
    draft.washType = "detailing";
    draft.cost = "";

    expect(resolveWashCost(draft)).toBe(0);

    draft.cost = "88";
    expect(resolveWashCost(draft)).toBe(88);
    expect(buildWashRecord("vehicle_1", draft).cost).toBe(88);
  });

  it("keeps default steps out of shop wash drafts when the wash type changes", () => {
    const diyDraft = createEmptyWashDraft();
    const shopDraft = changeWashDraftType(diyDraft, "detailing");

    expect(shopDraft).toMatchObject({ washType: "detailing", items: "" });
    expect(changeWashDraftType(shopDraft, "diy")).toMatchObject({
      washType: "diy",
      items: "预洗, 正洗, 轮毂",
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

  it("does not add a blank product row when editing a wash without products", () => {
    expect(createWashDraft(baseWashRecord).products).toEqual([]);
  });

  it("suggests practical steps and usage units from warehouse metadata", () => {
    expect(getDefaultWashStepForProductCategory("玻璃去油膜")).toBe("玻璃");
    expect(getDefaultWashStepForProductCategory("轮毂清洁")).toBe("轮毂");
    expect(getDefaultWashStepForProductCategory("未知类型")).toBe("其他");
    expect(getSuggestedWashUsageUnit("L")).toBe("ml");
    expect(getSuggestedWashUsageUnit("kg")).toBe("g");
    expect(getSuggestedWashUsageUnit("pcs")).toBe("pcs");
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
