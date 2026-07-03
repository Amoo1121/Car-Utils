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

export interface RemoteStoreRepository {
  getStore(): Promise<Store | null>;
  putStore(store: Store): Promise<Store>;
}

export interface LegacyStoreRepository {
  loadLegacyStore(): Store | null;
  saveLegacyStore(store: Store): void;
}

export interface StoreRepository {
  load(): Promise<StoreLoadResult>;
  save(store: Store): Promise<void>;
  replace(store: Store): Promise<void>;
  getPersistenceStatus(): PersistenceStatusSnapshot | null;
  subscribePersistenceStatus(listener: PersistenceStatusListener): () => void;
}
