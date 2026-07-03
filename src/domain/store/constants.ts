import type { EnergyType, Store } from "./types";

export const STORAGE_KEY = "car-utils-store-v1";
export const DATA_SCHEMA_VERSION = 1;
export const DEVICE_ID_STORAGE_KEY = "car-utils-device-id";

export const vehiclePresets = [
  { brand: "Toyota", model: "Camry", energyType: "汽油" as EnergyType, tankSize: 60 },
  { brand: "Honda", model: "CR-V", energyType: "混动" as EnergyType, tankSize: 57 },
  { brand: "Tesla", model: "Model 3", energyType: "纯电" as EnergyType, batterySize: 60 },
  { brand: "BYD", model: "秦 PLUS DM-i", energyType: "混动" as EnergyType, tankSize: 48 },
  { brand: "Li Auto", model: "L7", energyType: "增程" as EnergyType, tankSize: 65, batterySize: 42 },
];

export const fuelGrades = ["92#", "95#", "98#", "爱跑98", "0#柴油", "其他"];

export const emptyStore: Store = {
  users: [],
  vehicles: [],
  fuelRecords: [],
  washRecords: [],
  washProducts: [],
  expenseRecords: [],
  schemaVersion: DATA_SCHEMA_VERSION,
  syncState: {
    pendingChanges: [],
    cloudEnabled: false,
  },
};
