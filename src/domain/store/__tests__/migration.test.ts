import { describe, expect, it } from "vitest";
import { DATA_SCHEMA_VERSION, STORAGE_KEY, normalizeStore } from "../../../shared/carData";

describe("store migration", () => {
  it("normalizes empty values into a valid store", () => {
    for (const value of [undefined, null, {}]) {
      const store = normalizeStore(value);

      expect(store.schemaVersion).toBe(DATA_SCHEMA_VERSION);
      expect(store.users).toEqual([]);
      expect(store.vehicles).toEqual([]);
      expect(store.fuelRecords).toEqual([]);
      expect(store.washRecords).toEqual([]);
      expect(store.washProducts).toEqual([]);
      expect(store.expenseRecords).toEqual([]);
      expect(store.syncState).toMatchObject({
        pendingChanges: [],
        cloudEnabled: false,
      });
      expect(store.deviceId).toBeTruthy();
    }
  });

  it("migrates legacy data without schemaVersion", () => {
    const store = normalizeStore({
      deviceId: "device_legacy",
      users: [
        {
          id: "user_1",
          name: "Amoo",
          email: "AMOO@example.com",
        },
      ],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "",
          brand: "",
          model: "Model 3",
          year: "",
          plate: "",
          energyType: "纯电",
        },
      ],
    });

    expect(store.schemaVersion).toBe(DATA_SCHEMA_VERSION);
    expect(store.deviceId).toBe("device_legacy");
    expect(store.users[0]).toMatchObject({
      id: "user_1",
      type: "user",
      email: "amoo@example.com",
      deletedAt: null,
      deviceId: "device_legacy",
      source: "migration",
      schemaVersion: DATA_SCHEMA_VERSION,
    });
    expect(store.vehicles[0]).toMatchObject({
      id: "vehicle_1",
      type: "vehicle",
      userId: "user_1",
      nickname: "Model 3",
      deletedAt: null,
      deviceId: "device_legacy",
      source: "migration",
      schemaVersion: DATA_SCHEMA_VERSION,
    });
  });

  it("fills missing metadata for every entity collection", () => {
    const store = normalizeStore({
      deviceId: "device_meta",
      users: [{ id: "user_1", name: "User", email: "user@example.com" }],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
        },
      ],
      fuelRecords: [
        {
          id: "fuel_1",
          userId: "user_1",
          vehicleId: "vehicle_1",
          date: "2026-01-01",
          volume: 10,
          pricePerUnit: 8,
          totalCost: 80,
          station: "中石化",
          fullTank: false,
        },
      ],
      washRecords: [
        {
          id: "wash_1",
          userId: "user_1",
          vehicleId: "vehicle_1",
          date: "2026-01-02",
          items: [],
          minutes: 30,
          cost: 20,
          notes: "",
        },
      ],
      washProducts: [
        {
          id: "product_1",
          userId: "user_1",
          name: "预洗液",
          category: "预洗",
          purchases: [{ id: "", date: "", purchasePrice: "88", capacity: "500", capacityUnit: "" }],
        },
      ],
      expenseRecords: [
        {
          id: "expense_1",
          userId: "user_1",
          vehicleId: "vehicle_1",
          date: "2026-01-03",
          category: "maintenance",
          title: "保养",
          amount: 500,
        },
      ],
    });

    const entities = [
      store.users[0],
      store.vehicles[0],
      store.fuelRecords[0],
      store.washRecords[0],
      store.washProducts[0],
      store.expenseRecords[0],
    ];

    entities.forEach((entity) => {
      expect(entity.createdAt).toEqual(expect.any(Number));
      expect(entity.updatedAt).toEqual(expect.any(Number));
      expect(entity.deletedAt).toBeNull();
      expect(entity.deviceId).toBe("device_meta");
      expect(entity.schemaVersion).toBe(DATA_SCHEMA_VERSION);
    });
    expect(store.washProducts[0].purchases[0]).toMatchObject({
      date: expect.any(String),
      purchasePrice: 88,
      capacity: 500,
      capacityUnit: "ml",
    });
    expect(store.washProducts[0].purchases[0].id).toBeTruthy();
  });

  it("consolidates duplicate email users and remaps owned records to the canonical user", () => {
    const store = normalizeStore({
      deviceId: "device_merge",
      currentUserId: "user_duplicate",
      users: [
        {
          id: "user_canonical",
          name: "旧名称",
          email: "owner@example.com",
          createdAt: 100,
          updatedAt: 200,
        },
        {
          id: "user_duplicate",
          name: "新名称",
          email: " OWNER@example.com ",
          createdAt: 150,
          updatedAt: 300,
        },
      ],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_duplicate",
          nickname: "车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
        },
      ],
      fuelRecords: [
        {
          id: "fuel_1",
          userId: "user_duplicate",
          vehicleId: "vehicle_1",
          date: "2026-01-01",
          volume: 10,
          pricePerUnit: 8,
          totalCost: 80,
          station: "中石化",
          fullTank: false,
        },
      ],
      washRecords: [
        {
          id: "wash_1",
          userId: "user_duplicate",
          vehicleId: "vehicle_1",
          date: "2026-01-02",
          items: [],
          minutes: 30,
          cost: 20,
          notes: "",
        },
      ],
      washProducts: [
        {
          id: "product_1",
          userId: "user_duplicate",
          name: "正洗液",
          category: "正洗",
          purchases: [],
        },
      ],
      expenseRecords: [
        {
          id: "expense_1",
          userId: "user_duplicate",
          vehicleId: "vehicle_1",
          date: "2026-01-03",
          category: "maintenance",
          title: "保养",
          amount: 500,
        },
      ],
    });

    expect(store.users).toHaveLength(1);
    expect(store.currentUserId).toBe("user_canonical");
    expect(store.users[0]).toMatchObject({
      id: "user_canonical",
      name: "新名称",
      email: "owner@example.com",
      updatedAt: 300,
    });
    expect(store.vehicles[0].userId).toBe("user_canonical");
    expect(store.fuelRecords[0].userId).toBe("user_canonical");
    expect(store.washRecords[0].userId).toBe("user_canonical");
    expect(store.washProducts[0].userId).toBe("user_canonical");
    expect(store.expenseRecords[0].userId).toBe("user_canonical");
  });

  it("keeps soft-deleted deletedAt timestamps", () => {
    const store = normalizeStore({
      deviceId: "device_deleted",
      users: [
        {
          id: "user_1",
          name: "User",
          email: "deleted@example.com",
          deletedAt: 456,
        },
      ],
    });

    expect(store.users[0].deletedAt).toBe(456);
  });

  it("keeps the localStorage key stable", () => {
    expect(STORAGE_KEY).toBe("car-utils-store-v1");
  });
});
