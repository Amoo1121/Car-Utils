import type { Store } from "../shared/carData";

export type PersistenceStatus =
  | "backend_connected"
  | "backend_empty_importing_legacy"
  | "backend_persisted"
  | "backend_unavailable_using_local_backup"
  | "save_failed_local_backup_only";

export type PersistenceStatusSnapshot = {
  status: PersistenceStatus;
  updatedAt: number;
  error?: Error;
};

export type PersistenceStatusListener = (snapshot: PersistenceStatusSnapshot) => void;

export type StoreLoadSource = "remote" | "legacy" | "empty";

export type StoreLoadResult = {
  store: Store;
  source: StoreLoadSource;
  remoteAvailable: boolean;
  migratedFromLegacy: boolean;
  persistenceStatus: PersistenceStatusSnapshot;
  error?: Error;
};

export type RemoteStoreSnapshot = {
  store: Store;
  version?: number;
  updatedAt?: number;
};

export type PutStoreOptions = {
  expectedVersion?: number | null;
};

export interface RemoteStoreRepository {
  getStore(): Promise<RemoteStoreSnapshot | null>;
  putStore(store: Store, options?: PutStoreOptions): Promise<RemoteStoreSnapshot>;
}

export type LegacyStoreSnapshot = {
  store: Store;
  savedAt?: number;
};

export type SaveLegacyStoreOptions = {
  savedAt?: number;
};

export interface LegacyStoreRepository {
  loadLegacyStore(): Store | null;
  loadLegacyStoreSnapshot(): LegacyStoreSnapshot | null;
  saveLegacyStore(store: Store, options?: SaveLegacyStoreOptions): void;
}

export interface StoreRepository {
  load(): Promise<StoreLoadResult>;
  save(store: Store): Promise<void>;
  replace(store: Store): Promise<void>;
  getPersistenceStatus(): PersistenceStatusSnapshot | null;
  subscribePersistenceStatus(listener: PersistenceStatusListener): () => void;
}
