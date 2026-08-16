import { STORAGE_KEY, normalizeStore, type Store } from "../shared/carData";
import type { LegacyStoreRepository, SaveLegacyStoreOptions } from "./storeRepository";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalStorageStoreRepository implements LegacyStoreRepository {
  private readonly metadataKey: string;

  constructor(
    private readonly storage: StorageLike | null = getBrowserLocalStorage(),
    private readonly storageKey = STORAGE_KEY,
  ) {
    this.metadataKey = `${storageKey}:metadata`;
  }

  loadLegacyStore() {
    return this.loadLegacyStoreSnapshot()?.store ?? null;
  }

  loadLegacyStoreSnapshot() {
    if (!this.storage) return null;

    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      const store = normalizeStore(JSON.parse(raw));
      this.storage.setItem(this.storageKey, JSON.stringify(store));
      return {
        store,
        savedAt: this.loadLegacyStoreSavedAt(),
      };
    } catch (error) {
      console.warn("Failed to read legacy Car Utils localStorage store.", error);
      this.storage.removeItem(this.storageKey);
      this.storage.removeItem(this.metadataKey);
      return null;
    }
  }

  saveLegacyStore(store: Store, options: SaveLegacyStoreOptions = {}) {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(normalizeStore(store)));
    this.storage.setItem(
      this.metadataKey,
      JSON.stringify({
        savedAt: options.savedAt ?? Date.now(),
      }),
    );
  }

  private loadLegacyStoreSavedAt() {
    if (!this.storage) return undefined;

    try {
      const raw = this.storage.getItem(this.metadataKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { savedAt?: unknown };
      return typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : undefined;
    } catch {
      return undefined;
    }
  }
}

export function createLocalStorageStoreRepository(storage?: StorageLike | null, storageKey = STORAGE_KEY) {
  return new LocalStorageStoreRepository(storage, storageKey);
}

function getBrowserLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}
