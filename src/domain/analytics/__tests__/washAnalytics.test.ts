import { describe, expect, it } from "vitest";
import type { WashProduct, WashRecord } from "../../store/types";
import { calculateWashOverview, calculateWashProductInventory } from "../washAnalytics";

describe("washAnalytics", () => {
  it("returns zeroed wash cost stats for empty data", () => {
    expect(calculateWashOverview([])).toEqual({
      washCost: 0,
      recordCount: 0,
      averageCost: 0,
    });
  });

  it("calculates wash cost totals and averages", () => {
    expect(
      calculateWashOverview([
        createWashRecord({ id: "wash_1", cost: 20 }),
        createWashRecord({ id: "wash_2", cost: 40 }),
      ]),
    ).toEqual({
      washCost: 60,
      recordCount: 2,
      averageCost: 30,
    });
  });

  it("estimates wash product inventory across compatible units", () => {
    const product: WashProduct = {
      id: "product_1",
      userId: "user_1",
      name: "预洗液",
      category: "预洗液",
      purchases: [{ id: "purchase_1", date: "2026-01-01", capacity: 2, capacityUnit: "L" }],
    };
    const stats = calculateWashProductInventory(product, [
      createWashRecord({
        id: "wash_1",
        products: [{ name: "预洗液", productId: "product_1", usedAmount: 500, usedUnit: "ml" }],
      }),
    ]);

    expect(stats).toEqual({
      hasCapacity: true,
      unit: "L",
      purchased: 2,
      used: 0.5,
      remaining: 1.5,
    });
  });

  it("reports inventory without capacity for non-volume products", () => {
    const product: WashProduct = {
      id: "product_1",
      userId: "user_1",
      name: "毛巾",
      category: "毛巾/工具",
      purchases: [{ id: "purchase_1", date: "2026-01-01" }],
    };

    expect(calculateWashProductInventory(product, [])).toEqual({
      hasCapacity: false,
      unit: "ml",
      purchased: 0,
      used: 0,
      remaining: 0,
    });
  });

  it("excludes soft-deleted wash records from costs and inventory usage", () => {
    const product: WashProduct = {
      id: "product_1",
      userId: "user_1",
      name: "正洗液",
      category: "正洗液",
      purchases: [{ id: "purchase_1", date: "2026-01-01", capacity: 1000, capacityUnit: "ml" }],
    };
    const active = createWashRecord({
      id: "wash_active",
      cost: 20,
      products: [{ name: "正洗液", productId: "product_1", usedAmount: 100, usedUnit: "ml" }],
    });
    const deleted = createWashRecord({
      id: "wash_deleted",
      cost: 100,
      deletedAt: 123,
      products: [{ name: "正洗液", productId: "product_1", usedAmount: 500, usedUnit: "ml" }],
    });

    expect(calculateWashOverview([active, deleted])).toEqual({ washCost: 20, recordCount: 1, averageCost: 20 });
    expect(calculateWashProductInventory(product, [active, deleted])).toMatchObject({ used: 100, remaining: 900 });
  });
});

function createWashRecord(overrides: Partial<WashRecord> = {}): WashRecord {
  return {
    id: "wash_default",
    userId: "user_1",
    vehicleId: "vehicle_1",
    date: "2026-01-01",
    items: [],
    minutes: 30,
    cost: 20,
    notes: "",
    deletedAt: null,
    ...overrides,
  };
}
