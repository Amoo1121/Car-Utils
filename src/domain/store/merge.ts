import { DATA_SCHEMA_VERSION } from "./constants";
import { createEmptyStore, normalizeStore } from "./migration";
import type { BaseEntity, Store } from "./types";
import { getEntityTime, getOrCreateDeviceId } from "./utils";

export function mergeStores(localStore: Store, incomingStore: Store): Store {
  const local = normalizeStore(localStore);
  const incoming = normalizeStore(incomingStore);
  const users = mergeEntities(local.users, incoming.users);
  const currentUserId = incoming.currentUserId ?? local.currentUserId;

  return normalizeStore({
    users,
    vehicles: mergeEntities(local.vehicles, incoming.vehicles),
    fuelRecords: mergeEntities(local.fuelRecords, incoming.fuelRecords),
    washRecords: mergeEntities(local.washRecords, incoming.washRecords),
    washProducts: mergeEntities(local.washProducts, incoming.washProducts),
    expenseRecords: mergeEntities(local.expenseRecords, incoming.expenseRecords),
    currentUserId: currentUserId && users.some((user) => user.id === currentUserId) ? currentUserId : users[0]?.id,
    deviceId: local.deviceId ?? incoming.deviceId ?? getOrCreateDeviceId(),
    schemaVersion: DATA_SCHEMA_VERSION,
    syncState: local.syncState ?? incoming.syncState ?? createEmptyStore().syncState,
  });
}

function mergeEntities<T extends BaseEntity>(localItems: T[], incomingItems: T[]) {
  const merged = new Map<string, T>();

  localItems.forEach((item) => {
    if (item.id) merged.set(item.id, item);
  });

  incomingItems.forEach((item) => {
    if (!item.id) return;

    const existing = merged.get(item.id);
    if (!existing || getEntityTime(item) > getEntityTime(existing)) {
      merged.set(item.id, item);
    }
  });

  return [...merged.values()];
}
