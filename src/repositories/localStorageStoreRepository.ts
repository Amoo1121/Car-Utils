import { STORAGE_KEY, normalizeStore, type Store } from "../shared/carData";
import type { LegacyStoreRepository, SaveLegacyStoreOptions } from "./storeRepository";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const LEGACY_BACKUP_METADATA_KEY = `${STORAGE_KEY}:metadata`;

export class LocalStorageStoreRepository implements LegacyStoreRepository {
  constructor(private readonly storage: StorageLike | null = getBrowserLocalStorage()) {}

  loadLegacyStore() {
    return this.loadLegacyStoreSnapshot()?.store ?? null;
  }

  loadLegacyStoreSnapshot() {
    if (!this.storage) return null;

    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const store = normalizeStore(JSON.parse(raw));
      this.storage.setItem(STORAGE_KEY, JSON.stringify(store));
      return {
        store,
        savedAt: this.loadLegacyStoreSavedAt(),
      };
    } catch (error) {
      console.warn("Failed to read legacy Car Utils localStorage store.", error);
      this.storage.removeItem(STORAGE_KEY);
      this.storage.removeItem(LEGACY_BACKUP_METADATA_KEY);
      return null;
    }
  }

  saveLegacyStore(store: Store, options: SaveLegacyStoreOptions = {}) {
    if (!this.storage) return;
    this.storage.setItem(STORAGE_KEY, JSON.stringify(normalizeStore(store)));
    this.storage.setItem(
      LEGACY_BACKUP_METADATA_KEY,
      JSON.stringify({
        savedAt: options.savedAt ?? Date.now(),
      }),
    );
  }

  private loadLegacyStoreSavedAt() {
    if (!this.storage) return undefined;

    try {
      const raw = this.storage.getItem(LEGACY_BACKUP_METADATA_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { savedAt?: unknown };
      return typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : undefined;
    } catch {
      return undefined;
    }
  }
}

export function createLocalStorageStoreRepository(storage?: StorageLike | null) {
  return new LocalStorageStoreRepository(storage);
}

function getBrowserLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}
