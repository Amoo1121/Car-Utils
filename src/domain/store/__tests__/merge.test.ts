import { describe, expect, it } from "vitest";
import { mergeStores, normalizeStore } from "../../../shared/carData";

describe("store merge", () => {
  it("keeps local-only and remote-only records", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      users: [{ id: "local_user", name: "Local", email: "local@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "local_vehicle",
          userId: "local_user",
          nickname: "本地车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      users: [{ id: "remote_user", name: "Remote", email: "remote@example.com", createdAt: 2, updatedAt: 2 }],
      vehicles: [
        {
          id: "remote_vehicle",
          userId: "remote_user",
          nickname: "云端车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "纯电",
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });

    const merged = mergeStores(local, remote);

    expect(merged.users.map((user) => user.id).sort()).toEqual(["local_user", "remote_user"]);
    expect(merged.vehicles.map((vehicle) => vehicle.id).sort()).toEqual(["local_vehicle", "remote_vehicle"]);
  });

  it("uses the newer updatedAt version when ids match", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "旧名称",
          brand: "Old",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
          createdAt: 1,
          updatedAt: 100,
        },
      ],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "新名称",
          brand: "New",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
          createdAt: 1,
          updatedAt: 200,
        },
      ],
    });

    const merged = mergeStores(local, remote);

    expect(merged.vehicles).toHaveLength(1);
    expect(merged.vehicles[0]).toMatchObject({
      id: "vehicle_1",
      nickname: "新名称",
      brand: "New",
      updatedAt: 200,
    });
  });

  it("keeps the newer soft-delete state when the delete has the newer updatedAt", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      fuelRecords: [
        {
          id: "fuel_1",
          userId: "user_1",
          vehicleId: "vehicle_1",
          date: "2026-01-01",
          volume: 20,
          pricePerUnit: 8,
          totalCost: 160,
          station: "本地加油站",
          fullTank: false,
          createdAt: 1,
          updatedAt: 100,
          deletedAt: null,
        },
      ],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      fuelRecords: [
        {
          id: "fuel_1",
          userId: "user_1",
          vehicleId: "vehicle_1",
          date: "2026-01-01",
          volume: 20,
          pricePerUnit: 8,
          totalCost: 160,
          station: "本地加油站",
          fullTank: false,
          createdAt: 1,
          updatedAt: 300,
          deletedAt: 300,
        },
      ],
    });

    const merged = mergeStores(local, remote);

    expect(merged.fuelRecords[0]).toMatchObject({
      id: "fuel_1",
      updatedAt: 300,
      deletedAt: 300,
    });
  });

  it("merges different users, vehicles, fuel, wash, wash product, and expense records", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      users: [{ id: "local_user", name: "Local", email: "local@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "local_vehicle",
          userId: "local_user",
          nickname: "本地车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
        },
      ],
      fuelRecords: [
        {
          id: "local_fuel",
          userId: "local_user",
          vehicleId: "local_vehicle",
          date: "2026-01-01",
          volume: 10,
          pricePerUnit: 8,
          totalCost: 80,
          station: "本地站",
          fullTank: false,
        },
      ],
      washRecords: [
        {
          id: "local_wash",
          userId: "local_user",
          vehicleId: "local_vehicle",
          date: "2026-01-02",
          items: [],
          minutes: 30,
          cost: 20,
          notes: "",
        },
      ],
      washProducts: [
        {
          id: "local_product",
          userId: "local_user",
          name: "本地耗材",
          category: "预洗",
          purchases: [],
        },
      ],
      expenseRecords: [
        {
          id: "local_expense",
          userId: "local_user",
          vehicleId: "local_vehicle",
          date: "2026-01-03",
          category: "maintenance",
          title: "本地费用",
          amount: 100,
        },
      ],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      users: [{ id: "remote_user", name: "Remote", email: "remote@example.com", createdAt: 2, updatedAt: 2 }],
      vehicles: [
        {
          id: "remote_vehicle",
          userId: "remote_user",
          nickname: "云端车",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "纯电",
        },
      ],
      fuelRecords: [
        {
          id: "remote_fuel",
          userId: "remote_user",
          vehicleId: "remote_vehicle",
          date: "2026-02-01",
          volume: 15,
          pricePerUnit: 7,
          totalCost: 105,
          station: "云端站",
          fullTank: true,
        },
      ],
      washRecords: [
        {
          id: "remote_wash",
          userId: "remote_user",
          vehicleId: "remote_vehicle",
          date: "2026-02-02",
          items: [],
          minutes: 40,
          cost: 30,
          notes: "",
        },
      ],
      washProducts: [
        {
          id: "remote_product",
          userId: "remote_user",
          name: "云端耗材",
          category: "正洗",
          purchases: [],
        },
      ],
      expenseRecords: [
        {
          id: "remote_expense",
          userId: "remote_user",
          vehicleId: "remote_vehicle",
          date: "2026-02-03",
          category: "repair",
          title: "云端费用",
          amount: 200,
        },
      ],
    });

    const merged = mergeStores(local, remote);

    expect(merged.users).toHaveLength(2);
    expect(merged.vehicles).toHaveLength(2);
    expect(merged.fuelRecords).toHaveLength(2);
    expect(merged.washRecords).toHaveLength(2);
    expect(merged.washProducts).toHaveLength(2);
    expect(merged.expenseRecords).toHaveLength(2);
  });

  it("keeps currentUserId behavior aligned with the legacy merge implementation", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      currentUserId: "local_user",
      users: [{ id: "local_user", name: "Local", email: "local@example.com", createdAt: 1, updatedAt: 1 }],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      currentUserId: "remote_user",
      users: [{ id: "remote_user", name: "Remote", email: "remote@example.com", createdAt: 2, updatedAt: 2 }],
    });

    expect(mergeStores(local, remote).currentUserId).toBe("remote_user");
  });

  it("does not let remote syncState overwrite the local syncState", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      syncState: {
        lastSyncAt: 100,
        pendingChanges: [],
        cloudEnabled: false,
      },
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      syncState: {
        lastSyncAt: 999,
        pendingChanges: [],
        cloudEnabled: true,
        cloudUserId: "remote_cloud_user",
      },
    });

    const merged = mergeStores(local, remote);

    expect(merged.syncState).toMatchObject({
      lastSyncAt: 100,
      pendingChanges: [],
      cloudEnabled: false,
    });
    expect(merged.syncState?.cloudUserId).toBeUndefined();
  });

  it("keeps local content when updatedAt is the same and content differs", () => {
    const local = normalizeStore({
      deviceId: "local_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "本地版本",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
          createdAt: 1,
          updatedAt: 100,
        },
      ],
    });
    const remote = normalizeStore({
      deviceId: "remote_device",
      users: [{ id: "user_1", name: "User", email: "user@example.com", createdAt: 1, updatedAt: 1 }],
      vehicles: [
        {
          id: "vehicle_1",
          userId: "user_1",
          nickname: "云端版本",
          brand: "",
          model: "",
          year: "",
          plate: "",
          energyType: "汽油",
          createdAt: 1,
          updatedAt: 100,
        },
      ],
    });

    const merged = mergeStores(local, remote);

    // TODO(Phase 5): add explicit conflict tracking for same updatedAt with different content.
    expect(merged.vehicles[0].nickname).toBe("本地版本");
  });
});
