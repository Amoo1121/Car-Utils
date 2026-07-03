import { STORAGE_KEY, normalizeStore, type Store } from "../shared/carData";
import type { LegacyStoreRepository } from "./storeRepository";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalStorageStoreRepository implements LegacyStoreRepository {
  constructor(private readonly storage: StorageLike | null = getBrowserLocalStorage()) {}

  loadLegacyStore() {
    if (!this.storage) return null;

    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const store = normalizeStore(JSON.parse(raw));
      this.storage.setItem(STORAGE_KEY, JSON.stringify(store));
      return store;
    } catch (error) {
      console.warn("Failed to read legacy Car Utils localStorage store.", error);
      this.storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  saveLegacyStore(store: Store) {
    if (!this.storage) return;
    this.storage.setItem(STORAGE_KEY, JSON.stringify(normalizeStore(store)));
  }
}

export function createLocalStorageStoreRepository(storage?: StorageLike | null) {
  return new LocalStorageStoreRepository(storage);
}

function getBrowserLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}
