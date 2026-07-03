import { mergeStores, normalizeStore, type Store } from "../shared/carData";
import { StoreVersionConflictError, createHttpStoreRepository } from "./httpStoreRepository";
import { createLocalStorageStoreRepository } from "./localStorageStoreRepository";
import type {
  LegacyStoreRepository,
  LegacyStoreSnapshot,
  PersistenceStatus,
  PersistenceStatusListener,
  PersistenceStatusSnapshot,
  RemoteStoreSnapshot,
  RemoteStoreRepository,
  StoreRepository,
} from "./storeRepository";

export class HybridStoreRepository implements StoreRepository {
  private saveQueue = Promise.resolve();
  private persistenceStatus: PersistenceStatusSnapshot | null = null;
  private readonly persistenceStatusListeners = new Set<PersistenceStatusListener>();
  private latestSaveSequence = 0;
  private remoteVersion: number | null | undefined;
  private remoteUpdatedAt: number | undefined;

  constructor(
    private readonly remoteRepository: RemoteStoreRepository,
    private readonly legacyRepository: LegacyStoreRepository,
  ) {}

  async load() {
    try {
      const remoteSnapshot = await this.remoteRepository.getStore();
      const legacySnapshot = this.legacyRepository.loadLegacyStoreSnapshot();
      if (remoteSnapshot) {
        this.rememberRemoteSnapshot(remoteSnapshot);
        if (legacySnapshot && shouldPreferLegacySnapshot(legacySnapshot, remoteSnapshot)) {
          this.setPersistenceStatus("backend_empty_importing_legacy");
          const savedSnapshot = await this.remoteRepository.putStore(legacySnapshot.store, {
            expectedVersion: remoteSnapshot.version,
          });
          this.rememberRemoteSnapshot(savedSnapshot);
          this.legacyRepository.saveLegacyStore(savedSnapshot.store, {
            savedAt: savedSnapshot.updatedAt,
          });
          const persistenceStatus = this.setPersistenceStatus("backend_persisted");
          return {
            store: savedSnapshot.store,
            source: "legacy" as const,
            remoteAvailable: true,
            migratedFromLegacy: true,
            persistenceStatus,
          };
        }

        this.legacyRepository.saveLegacyStore(remoteSnapshot.store, {
          savedAt: remoteSnapshot.updatedAt,
        });
        const persistenceStatus = this.setPersistenceStatus("backend_connected");
        return {
          store: normalizeStore(remoteSnapshot.store),
          source: "remote" as const,
          remoteAvailable: true,
          migratedFromLegacy: false,
          persistenceStatus,
        };
      }

      this.remoteVersion = null;
      this.remoteUpdatedAt = undefined;
      if (legacySnapshot) {
        const normalizedStore = normalizeStore(legacySnapshot.store);
        this.setPersistenceStatus("backend_empty_importing_legacy");
        const savedSnapshot = await this.remoteRepository.putStore(normalizedStore, {
          expectedVersion: null,
        });
        this.rememberRemoteSnapshot(savedSnapshot);
        this.legacyRepository.saveLegacyStore(savedSnapshot.store, {
          savedAt: savedSnapshot.updatedAt,
        });
        const persistenceStatus = this.setPersistenceStatus("backend_persisted");
        return {
          store: savedSnapshot.store,
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
    const saveSequence = this.latestSaveSequence + 1;
    this.latestSaveSequence = saveSequence;
    this.legacyRepository.saveLegacyStore(normalizedStore);

    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(() => this.persist(normalizedStore, saveSequence));

    await this.saveQueue;
  }

  async replace(store: Store) {
    await this.save(store);
  }

  private async persist(normalizedStore: Store, saveSequence: number) {
    const store = normalizeStore(normalizedStore);

    try {
      const savedSnapshot = await this.putWithKnownVersion(store);
      this.rememberRemoteSnapshot(savedSnapshot);
      if (this.isLatestSave(saveSequence)) {
        this.legacyRepository.saveLegacyStore(savedSnapshot.store, {
          savedAt: savedSnapshot.updatedAt,
        });
        this.setPersistenceStatus("backend_persisted");
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn("Failed to save store to local API. Keeping legacy localStorage backup.", normalizedError);
      if (this.isLatestSave(saveSequence)) {
        this.legacyRepository.saveLegacyStore(store);
        this.setPersistenceStatus("save_failed_local_backup_only", normalizedError);
      }
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

  private async putWithKnownVersion(store: Store): Promise<RemoteStoreSnapshot> {
    let storeToSave = store;
    if (this.remoteVersion === undefined) {
      const remoteSnapshot = await this.remoteRepository.getStore();
      if (remoteSnapshot) {
        this.rememberRemoteSnapshot(remoteSnapshot);
        storeToSave = mergeStores(remoteSnapshot.store, storeToSave);
      } else {
        this.remoteVersion = null;
        this.remoteUpdatedAt = undefined;
      }
    }

    try {
      return await this.remoteRepository.putStore(storeToSave, {
        expectedVersion: this.remoteVersion,
      });
    } catch (error) {
      if (error instanceof StoreVersionConflictError && error.remoteSnapshot) {
        this.rememberRemoteSnapshot(error.remoteSnapshot);
        const mergedStore = mergeStores(error.remoteSnapshot.store, storeToSave);
        return this.remoteRepository.putStore(mergedStore, {
          expectedVersion: error.remoteSnapshot.version,
        });
      }

      throw error;
    }
  }

  private rememberRemoteSnapshot(snapshot: RemoteStoreSnapshot) {
    this.remoteVersion = snapshot.version;
    this.remoteUpdatedAt = snapshot.updatedAt;
  }

  private isLatestSave(saveSequence: number) {
    return saveSequence === this.latestSaveSequence;
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

function shouldPreferLegacySnapshot(legacySnapshot: LegacyStoreSnapshot, remoteSnapshot: RemoteStoreSnapshot) {
  return (
    typeof legacySnapshot?.savedAt === "number" &&
    typeof remoteSnapshot.updatedAt === "number" &&
    legacySnapshot.savedAt > remoteSnapshot.updatedAt
  );
}
