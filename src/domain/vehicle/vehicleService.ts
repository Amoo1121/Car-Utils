import type { Store, User, Vehicle } from "../store/types";
import {
  makeFallbackId,
  restoreEntity,
  softDeleteEntity,
  withCreatedTimestamps,
  withUpdatedTimestamp,
} from "../store/utils";

export type VehicleInput = Omit<Vehicle, "id" | "userId">;

export type VehicleMutationOptions = {
  id?: string;
  timestamp?: number;
};

export type AddVehicleResult = {
  store: Store;
  vehicle: Vehicle;
};

export function addVehicleToStore(
  store: Store,
  currentUser: User | undefined,
  vehicle: VehicleInput,
  options: VehicleMutationOptions = {},
): AddVehicleResult | null {
  if (!currentUser) return null;

  const nextVehicle = withCreatedTimestamps(
    {
      ...vehicle,
      id: options.id ?? makeFallbackId("vehicle"),
      userId: currentUser.id,
    },
    options.timestamp,
  );

  return {
    store: {
      ...store,
      vehicles: [...store.vehicles, nextVehicle],
    },
    vehicle: nextVehicle,
  };
}

export function updateVehicleInStore(
  store: Store,
  currentUser: User | undefined,
  vehicleId: string,
  vehicle: VehicleInput,
  options: VehicleMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    vehicles: store.vehicles.map((currentVehicle) =>
      currentVehicle.id === vehicleId && currentVehicle.userId === currentUser.id
        ? withUpdatedTimestamp(
            {
              ...vehicle,
              id: currentVehicle.id,
              userId: currentVehicle.userId,
              createdAt: currentVehicle.createdAt,
              deletedAt: currentVehicle.deletedAt,
            },
            options.timestamp,
          )
        : currentVehicle,
    ),
  };
}

export function archiveVehicleInStore(
  store: Store,
  currentUser: User | undefined,
  vehicleId: string,
  options: VehicleMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    vehicles: store.vehicles.map((vehicle) =>
      vehicle.id === vehicleId && vehicle.userId === currentUser.id
        ? withUpdatedTimestamp({ ...vehicle, isArchived: true }, options.timestamp)
        : vehicle,
    ),
  };
}

export function unarchiveVehicleInStore(
  store: Store,
  currentUser: User | undefined,
  vehicleId: string,
  options: VehicleMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    vehicles: store.vehicles.map((vehicle) =>
      vehicle.id === vehicleId && vehicle.userId === currentUser.id
        ? withUpdatedTimestamp({ ...vehicle, isArchived: false }, options.timestamp)
        : vehicle,
    ),
  };
}

export function softDeleteVehicleInStore(
  store: Store,
  currentUser: User | undefined,
  vehicleId: string,
  options: VehicleMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    vehicles: store.vehicles.map((vehicle) =>
      vehicle.id === vehicleId && vehicle.userId === currentUser.id ? softDeleteEntity(vehicle, options.timestamp) : vehicle,
    ),
  };
}

export function restoreVehicleInStore(
  store: Store,
  currentUser: User | undefined,
  vehicleId: string,
  options: VehicleMutationOptions = {},
) {
  if (!currentUser) return null;

  return {
    ...store,
    vehicles: store.vehicles.map((vehicle) =>
      vehicle.id === vehicleId && vehicle.userId === currentUser.id
        ? restoreEntity({ ...vehicle, isArchived: false }, options.timestamp)
        : vehicle,
    ),
  };
}
