import { normalizeStore, type Store } from "../shared/carData";
import { createHttpStoreRepository } from "./httpStoreRepository";
import { createLocalStorageStoreRepository } from "./localStorageStoreRepository";
import type {
  LegacyStoreRepository,
  PersistenceStatus,
  PersistenceStatusListener,
  PersistenceStatusSnapshot,
  RemoteStoreRepository,
  StoreRepository,
} from "./storeRepository";

export class HybridStoreRepository implements StoreRepository {
  private saveQueue = Promise.resolve();
  private persistenceStatus: PersistenceStatusSnapshot | null = null;
  private readonly persistenceStatusListeners = new Set<PersistenceStatusListener>();

  constructor(
    private readonly remoteRepository: RemoteStoreRepository,
    private readonly legacyRepository: LegacyStoreRepository,
  ) {}

  async load() {
    try {
      const remoteStore = await this.remoteRepository.getStore();
      if (remoteStore) {
        const persistenceStatus = this.setPersistenceStatus("backend_connected");
        return {
          store: normalizeStore(remoteStore),
          source: "remote" as const,
          remoteAvailable: true,
          migratedFromLegacy: false,
          persistenceStatus,
        };
      }

      const legacyStore = this.legacyRepository.loadLegacyStore();
      if (legacyStore) {
        const normalizedStore = normalizeStore(legacyStore);
        this.setPersistenceStatus("backend_empty_importing_legacy");
        const savedStore = await this.remoteRepository.putStore(normalizedStore);
        this.legacyRepository.saveLegacyStore(savedStore);
        const persistenceStatus = this.setPersistenceStatus("backend_persisted");
        return {
          store: savedStore,
          source: "legacy" as const,
          remoteAvailable: true,
          migratedFromLegacy: true,
          persistenceStatus,
        };
      }

      const persistenceStatus = this.setPersistenceStatus("backend_connected");
      return {
        store: normalizeStore(undefined),
        source: "empty" as const,
        remoteAvailable: true,
        migratedFromLegacy: false,
        persistenceStatus,
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn("Local API is unavailable. Falling back to legacy localStorage store.", normalizedError);

      const legacyStore = this.legacyRepository.loadLegacyStore();
      const persistenceStatus = this.setPersistenceStatus("backend_unavailable_using_local_backup", normalizedError);
      return {
        store: normalizeStore(legacyStore ?? undefined),
        source: legacyStore ? ("legacy" as const) : ("empty" as const),
        remoteAvailable: false,
        migratedFromLegacy: false,
        persistenceStatus,
        error: normalizedError,
      };
    }
  }

  async save(store: Store) {
    const normalizedStore = normalizeStore(store);

    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(() => this.persist(normalizedStore));

    await this.saveQueue;
  }

  async replace(store: Store) {
    await this.save(store);
  }

  private async persist(normalizedStore: Store) {
    const store = normalizeStore(normalizedStore);

    try {
      const savedStore = await this.remoteRepository.putStore(store);
      this.legacyRepository.saveLegacyStore(savedStore);
      this.setPersistenceStatus("backend_persisted");
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn("Failed to save store to local API. Keeping legacy localStorage backup.", normalizedError);
      this.legacyRepository.saveLegacyStore(store);
      this.setPersistenceStatus("save_failed_local_backup_only", normalizedError);
    }
  }

  getPersistenceStatus() {
    return this.persistenceStatus;
  }

  subscribePersistenceStatus(listener: PersistenceStatusListener) {
    this.persistenceStatusListeners.add(listener);
    if (this.persistenceStatus) listener(this.persistenceStatus);

    return () => {
      this.persistenceStatusListeners.delete(listener);
    };
  }

  private setPersistenceStatus(status: PersistenceStatus, error?: Error) {
    const snapshot: PersistenceStatusSnapshot = {
      status,
      updatedAt: Date.now(),
      error,
    };

    this.persistenceStatus = snapshot;
    this.persistenceStatusListeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }
}

export function createHybridStoreRepository(
  remoteRepository: RemoteStoreRepository = createHttpStoreRepository(),
  legacyRepository: LegacyStoreRepository = createLocalStorageStoreRepository(),
) {
  return new HybridStoreRepository(remoteRepository, legacyRepository);
}

export const storeRepository = createHybridStoreRepository();

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error || "Unknown store repository error"));
}
