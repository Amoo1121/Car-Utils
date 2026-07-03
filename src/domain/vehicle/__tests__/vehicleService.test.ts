import { describe, expect, it } from "vitest";
import type { Store, User, Vehicle } from "../../store/types";
import {
  addVehicleToStore,
  archiveVehicleInStore,
  restoreVehicleInStore,
  softDeleteVehicleInStore,
  unarchiveVehicleInStore,
  updateVehicleInStore,
  type VehicleInput,
} from "../vehicleService";

const currentUser: User = {
  id: "user_1",
  name: "Amoo",
  email: "amoo@example.com",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const otherUser: User = {
  id: "user_2",
  name: "Other",
  email: "other@example.com",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const baseVehicle: Vehicle = {
  id: "vehicle_1",
  userId: "user_1",
  nickname: "旧车",
  brand: "Toyota",
  model: "Camry",
  year: "2024",
  plate: "沪A12345",
  energyType: "汽油",
  createdAt: 100,
  updatedAt: 100,
  deletedAt: null,
};

const otherUserVehicle: Vehicle = {
  ...baseVehicle,
  id: "vehicle_2",
  userId: "user_2",
  nickname: "别人的车",
};

const vehicleInput: VehicleInput = {
  nickname: "新车",
  brand: "Honda",
  model: "CR-V",
  year: "2025",
  plate: "沪B54321",
  energyType: "混动",
};

describe("vehicleService", () => {
  it("adds a vehicle for the current user with created metadata", () => {
    const store = createStore();

    const result = addVehicleToStore(store, currentUser, vehicleInput, {
      id: "vehicle_new",
      timestamp: 1000,
    });

    expect(result).not.toBeNull();
    expect(result?.vehicle).toMatchObject({
      id: "vehicle_new",
      userId: "user_1",
      nickname: "新车",
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      schemaVersion: 1,
    });
    expect(result?.store.vehicles).toHaveLength(3);
    expect(store.vehicles).toHaveLength(2);
  });

  it("does not add a vehicle without a current user", () => {
    expect(addVehicleToStore(createStore(), undefined, vehicleInput)).toBeNull();
  });

  it("updates only the current user's matching vehicle and preserves identity fields", () => {
    const store = createStore();

    const nextStore = updateVehicleInStore(store, currentUser, "vehicle_1", vehicleInput, {
      timestamp: 2000,
    });

    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_1")).toMatchObject({
      id: "vehicle_1",
      userId: "user_1",
      nickname: "新车",
      brand: "Honda",
      createdAt: 100,
      updatedAt: 2000,
      deletedAt: null,
      schemaVersion: 1,
    });
    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_2")).toMatchObject(otherUserVehicle);
  });

  it("does not update another user's vehicle", () => {
    const store = createStore();

    const nextStore = updateVehicleInStore(store, currentUser, "vehicle_2", vehicleInput, {
      timestamp: 2000,
    });

    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_2")).toMatchObject(otherUserVehicle);
  });

  it("archives and unarchives the current user's vehicle", () => {
    const archivedStore = archiveVehicleInStore(createStore(), currentUser, "vehicle_1", {
      timestamp: 3000,
    });
    const unarchivedStore = unarchiveVehicleInStore(archivedStore!, currentUser, "vehicle_1", {
      timestamp: 4000,
    });

    expect(archivedStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_1")).toMatchObject({
      isArchived: true,
      updatedAt: 3000,
    });
    expect(unarchivedStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_1")).toMatchObject({
      isArchived: false,
      updatedAt: 4000,
    });
  });

  it("soft deletes with deletedAt and updatedAt using the same timestamp", () => {
    const nextStore = softDeleteVehicleInStore(createStore(), currentUser, "vehicle_1", {
      timestamp: 5000,
    });

    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_1")).toMatchObject({
      deletedAt: 5000,
      updatedAt: 5000,
    });
    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_2")).toMatchObject(otherUserVehicle);
  });

  it("restores a soft-deleted vehicle and clears archived state", () => {
    const deletedVehicle: Vehicle = {
      ...baseVehicle,
      isArchived: true,
      deletedAt: 5000,
      updatedAt: 5000,
    };
    const nextStore = restoreVehicleInStore(
      {
        ...createStore(),
        vehicles: [deletedVehicle, otherUserVehicle],
      },
      currentUser,
      "vehicle_1",
      {
        timestamp: 6000,
      },
    );

    expect(nextStore?.vehicles.find((vehicle) => vehicle.id === "vehicle_1")).toMatchObject({
      deletedAt: null,
      isArchived: false,
      updatedAt: 6000,
    });
  });
});

function createStore(): Store {
  return {
    users: [currentUser, otherUser],
    vehicles: [baseVehicle, otherUserVehicle],
    fuelRecords: [],
    washRecords: [],
    washProducts: [],
    expenseRecords: [],
    currentUserId: currentUser.id,
    schemaVersion: 1,
    syncState: {
      pendingChanges: [],
      cloudEnabled: false,
    },
  };
}
