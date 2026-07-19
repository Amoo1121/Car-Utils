import { describe, expect, it } from "vitest";
import type { Store, User, WashProduct, WashProductPurchase } from "../../store/types";
import {
  addWashProductPurchaseToStore,
  addWashProductToStore,
  applyWashProductPresetToDraft,
  buildWashProductFromUsageDraft,
  buildWashProductSubmission,
  createWashProductDraftFromProduct,
  createWashProductReplenishDraftFromProduct,
  restoreWashProductInStore,
  softDeleteWashProductInStore,
  updateWashProductInStore,
  type WashProductDraft,
} from "../washProductService";
import { getWashProductPreset } from "../washProductCatalog";

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

const basePurchase: WashProductPurchase = {
  id: "purchase_1",
  date: "2026-01-01",
  purchasePrice: 100,
  capacity: 1000,
  capacityUnit: "ml",
  note: "首购",
};

const baseProduct: WashProduct = {
  id: "product_1",
  userId: "user_1",
  name: "预洗液",
  brand: "Brand",
  category: "预洗液",
  purchases: [basePurchase],
  note: "旧备注",
  createdAt: 100,
  updatedAt: 100,
  deletedAt: null,
};

const otherProduct: WashProduct = {
  ...baseProduct,
  id: "product_2",
  userId: "user_2",
  name: "其他用户耗材",
};

describe("washProductService", () => {
  it("adds a wash product for the current user", () => {
    const result = addWashProductToStore(createStore(), currentUser, buildProductInput(), {
      id: "product_new",
      timestamp: 1000,
    });

    expect(result?.product).toMatchObject({
      id: "product_new",
      userId: "user_1",
      name: "正洗液",
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
    });
    expect(result?.store.washProducts).toHaveLength(3);
  });

  it("updates only the current user's matching wash product", () => {
    const nextStore = updateWashProductInStore(createStore(), currentUser, "product_1", buildProductInput({ name: "更新耗材" }), {
      timestamp: 2000,
    });

    expect(nextStore?.washProducts.find((product) => product.id === "product_1")).toMatchObject({
      name: "更新耗材",
      createdAt: 100,
      updatedAt: 2000,
      deletedAt: null,
    });
    expect(nextStore?.washProducts.find((product) => product.id === "product_2")).toMatchObject(otherProduct);
  });

  it("adds purchase records and keeps soft-delete restore behavior", () => {
    const replenishedStore = addWashProductPurchaseToStore(
      createStore(),
      currentUser,
      "product_1",
      { id: "purchase_2", date: "2026-02-01", purchasePrice: 80 },
      { timestamp: 3000 },
    );
    const deletedStore = softDeleteWashProductInStore(replenishedStore!, currentUser, "product_1", { timestamp: 4000 });
    const restoredStore = restoreWashProductInStore(deletedStore!, currentUser, "product_1", { timestamp: 5000 });

    expect(replenishedStore?.washProducts.find((product) => product.id === "product_1")?.purchases).toHaveLength(2);
    expect(replenishedStore?.washProducts.find((product) => product.id === "product_1")).toMatchObject({ updatedAt: 3000 });
    expect(deletedStore?.washProducts.find((product) => product.id === "product_1")).toMatchObject({
      deletedAt: 4000,
      updatedAt: 4000,
    });
    expect(restoredStore?.washProducts.find((product) => product.id === "product_1")).toMatchObject({
      deletedAt: null,
      updatedAt: 5000,
    });
  });

  it("builds add, edit, and replenish submissions from warehouse drafts", () => {
    const addSubmission = buildWashProductSubmission({ mode: "add", productId: "" }, createDraft(), undefined);
    const editSubmission = buildWashProductSubmission({ mode: "edit", productId: "product_1" }, createDraft(), baseProduct);
    const replenishSubmission = buildWashProductSubmission({ mode: "replenish", productId: "product_1" }, createDraft(), baseProduct);

    expect(addSubmission).toMatchObject({
      type: "add",
      product: {
        name: "正洗液",
        brand: "NewBrand",
        purchases: [expect.objectContaining({ purchasePrice: 88, capacity: 500 })],
      },
    });
    expect(editSubmission).toMatchObject({
      type: "update",
      productId: "product_1",
      product: {
        name: "正洗液",
        purchases: [expect.objectContaining({ purchasePrice: 88, capacity: 500 })],
      },
    });
    expect(replenishSubmission).toMatchObject({
      type: "replenish",
      productId: "product_1",
      purchase: expect.objectContaining({ purchasePrice: 88, capacity: 500 }),
    });
  });

  it("creates drafts from products for edit and replenish modes", () => {
    expect(createWashProductDraftFromProduct(baseProduct, "2026-03-01")).toMatchObject({
      name: "预洗液",
      purchaseDate: "2026-01-01",
      purchasePrice: "100",
      note: "旧备注",
    });
    expect(createWashProductReplenishDraftFromProduct(baseProduct, "2026-03-01")).toMatchObject({
      name: "预洗液",
      purchaseDate: "2026-03-01",
      purchasePrice: "100",
      note: "",
    });
  });

  it("applies a catalog preset and keeps its identity in the stored product", () => {
    const preset = getWashProductPreset("carpro-reset")!;
    const draft = applyWashProductPresetToDraft(createDraft(), preset);
    const submission = buildWashProductSubmission({ mode: "add", productId: "" }, draft, undefined);

    expect(draft).toMatchObject({
      presetId: "carpro-reset",
      name: "Reset Intensive Car Shampoo",
      brand: "CARPRO 卡普",
      category: "正洗液",
      capacity: "500",
      capacityUnit: "ml",
    });
    expect(submission).toMatchObject({
      type: "add",
      product: { presetId: "carpro-reset" },
    });
  });

  it("builds warehouse products from wash usage drafts", () => {
    expect(
      buildWashProductFromUsageDraft(
        {
          id: "usage_1",
          productId: "",
          name: "轮毂清洁",
          category: "轮毂清洁",
          step: "轮毂",
          purchasePrice: "60",
          capacity: "500",
          capacityUnit: "ml",
          usedAmount: "",
          usedUnit: "ml",
          dilutionRatio: "",
          estimatedCost: "",
          note: "",
        },
        "2026-02-01",
      ),
    ).toMatchObject({
      name: "轮毂清洁",
      purchases: [expect.objectContaining({ date: "2026-02-01", purchasePrice: 60, capacity: 500 })],
    });
  });
});

function createStore(): Store {
  return {
    users: [currentUser, otherUser],
    vehicles: [],
    fuelRecords: [],
    washRecords: [],
    washProducts: [baseProduct, otherProduct],
    expenseRecords: [],
    currentUserId: currentUser.id,
    schemaVersion: 1,
  };
}

function buildProductInput(overrides: Partial<Omit<WashProduct, "id" | "userId">> = {}) {
  return {
    type: "washProduct" as const,
    name: "正洗液",
    brand: "NewBrand",
    category: "正洗液",
    purchases: [{ id: "purchase_new", date: "2026-02-01", purchasePrice: 88 }],
    note: "新备注",
    ...overrides,
  };
}

function createDraft(): WashProductDraft {
  return {
    presetId: "",
    name: "正洗液",
    brand: "NewBrand",
    category: "正洗液",
    purchaseDate: "2026-02-01",
    purchasePrice: "88",
    capacity: "500",
    capacityUnit: "ml",
    note: "新备注",
  };
}
