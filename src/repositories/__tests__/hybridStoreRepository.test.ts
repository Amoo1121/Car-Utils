import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeStore, type Store } from "../../shared/carData";
import { HybridStoreRepository } from "../hybridStoreRepository";
import { StoreVersionConflictError } from "../httpStoreRepository";
import type {
  LegacyStoreRepository,
  PutStoreOptions,
  RemoteStoreRepository,
  RemoteStoreSnapshot,
  SaveLegacyStoreOptions,
} from "../storeRepository";

class MemoryRemoteRepository implements RemoteStoreRepository {
  savedStore: Store | null = null;
  version: number | undefined;
  updatedAt: number | undefined;

  constructor(
    private store: Store | null,
    private readonly shouldFail = false,
    metadata: { version?: number; updatedAt?: number } = {},
  ) {
    this.version = metadata.version;
    this.updatedAt = metadata.updatedAt;
  }

  async getStore() {
    if (this.shouldFail) throw new Error("API unavailable");
    return this.store
      ? {
          store: this.store,
          version: this.version,
          updatedAt: this.updatedAt,
        }
      : null;
  }

  async putStore(store: Store, options: PutStoreOptions = {}) {
    if (this.shouldFail) throw new Error("API unavailable");
    if (typeof options.expectedVersion === "number" && this.version !== options.expectedVersion) {
      throw new StoreVersionConflictError(this.store ? { store: this.store, version: this.version, updatedAt: this.updatedAt } : null);
    }
    if (options.expectedVersion === null && this.store) {
      throw new StoreVersionConflictError({ store: this.store, version: this.version, updatedAt: this.updatedAt });
    }
    this.savedStore = normalizeStore(store);
    this.store = this.savedStore;
    this.version = (this.version ?? 0) + 1;
    this.updatedAt = Date.now();
    return {
      store: this.savedStore,
      version: this.version,
      updatedAt: this.updatedAt,
    };
  }

  setRemoteSnapshot(store: Store, metadata: { version?: number; updatedAt?: number }) {
    this.store = store;
    this.version = metadata.version;
    this.updatedAt = metadata.updatedAt;
  }
}

class MemoryLegacyRepository implements LegacyStoreRepository {
  savedStore: Store | null = null;
  savedAt: number | undefined;

  constructor(
    private readonly store: Store | null,
    savedAt?: number,
  ) {
    this.savedAt = savedAt;
  }

  loadLegacyStore() {
    return this.loadLegacyStoreSnapshot()?.store ?? null;
  }

  loadLegacyStoreSnapshot() {
    if (!this.store) return null;
    return {
      store: this.store,
      savedAt: this.savedAt,
    };
  }

  saveLegacyStore(store: Store, options: SaveLegacyStoreOptions = {}) {
    this.savedStore = normalizeStore(store);
    this.savedAt = options.savedAt ?? Date.now();
  }
}

class DeferredRemoteRepository implements RemoteStoreRepository {
  requests: Array<{
    store: Store;
    resolve: (snapshot: RemoteStoreSnapshot) => void;
  }> = [];
  savedStores: Store[] = [];
  private version = 0;

  async getStore() {
    return null;
  }

  async putStore(store: Store) {
    return new Promise<RemoteStoreSnapshot>((resolve) => {
      this.requests.push({
        store: normalizeStore(store),
        resolve,
      });
    });
  }

  resolveNext() {
    const request = this.requests.shift();
    if (!request) throw new Error("No pending save request.");
    this.version += 1;
    this.savedStores.push(request.store);
    request.resolve({
      store: request.store,
      version: this.version,
      updatedAt: Date.now(),
    });
  }
}

describe("HybridStoreRepository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("migrates legacy localStorage data to the backend when the backend has no store", async () => {
    const legacyStore = normalizeStore({
      users: [{ id: "legacy_user", name: "Legacy", email: "legacy@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(null);
    const legacyRepository = new MemoryLegacyRepository(legacyStore);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);
    const statuses: string[] = [];
    repository.subscribePersistenceStatus((snapshot) => statuses.push(snapshot.status));

    const result = await repository.load();

    expect(result.source).toBe("legacy");
    expect(result.remoteAvailable).toBe(true);
    expect(result.migratedFromLegacy).toBe(true);
    expect(result.persistenceStatus.status).toBe("backend_persisted");
    expect(repository.getPersistenceStatus()?.status).toBe("backend_persisted");
    expect(statuses).toEqual(["backend_empty_importing_legacy", "backend_persisted"]);
    expect(result.store.users[0].id).toBe("legacy_user");
    expect(remoteRepository.savedStore?.users[0].id).toBe("legacy_user");
    expect(legacyRepository.savedStore?.users[0].id).toBe("legacy_user");
  });

  it("prefers backend data when the backend already has a store", async () => {
    const remoteStore = normalizeStore({
      users: [{ id: "remote_user", name: "Remote", email: "remote@example.com" }],
    });
    const legacyStore = normalizeStore({
      users: [{ id: "legacy_user", name: "Legacy", email: "legacy@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(remoteStore);
    const legacyRepository = new MemoryLegacyRepository(legacyStore);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    const result = await repository.load();

    expect(result.source).toBe("remote");
    expect(result.remoteAvailable).toBe(true);
    expect(result.migratedFromLegacy).toBe(false);
    expect(result.persistenceStatus.status).toBe("backend_connected");
    expect(repository.getPersistenceStatus()?.status).toBe("backend_connected");
    expect(result.store.users[0].id).toBe("remote_user");
    expect(remoteRepository.savedStore).toBeNull();
    expect(legacyRepository.savedStore?.users[0].id).toBe("remote_user");
  });

  it("save writes to the backend and keeps a legacy localStorage backup", async () => {
    const store = normalizeStore({
      users: [{ id: "user_1", name: "User", email: "user@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(null);
    const legacyRepository = new MemoryLegacyRepository(null);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    await repository.save(store);

    expect(remoteRepository.savedStore?.users[0].id).toBe("user_1");
    expect(legacyRepository.savedStore?.users[0].id).toBe("user_1");
    expect(repository.getPersistenceStatus()?.status).toBe("backend_persisted");
  });

  it("does not let an older queued save overwrite a newer localStorage backup", async () => {
    const firstStore = normalizeStore({
      users: [{ id: "user_1", name: "First", email: "user@example.com" }],
    });
    const secondStore = normalizeStore({
      users: [{ id: "user_1", name: "Second", email: "user@example.com" }],
    });
    const remoteRepository = new DeferredRemoteRepository();
    const legacyRepository = new MemoryLegacyRepository(null);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    const firstSave = repository.save(firstStore);
    const secondSave = repository.save(secondStore);
    await waitForAsyncQueue();

    expect(legacyRepository.savedStore?.users[0].name).toBe("Second");
    expect(remoteRepository.requests).toHaveLength(1);

    remoteRepository.resolveNext();
    await firstSave;
    await waitForAsyncQueue();

    expect(legacyRepository.savedStore?.users[0].name).toBe("Second");
    expect(remoteRepository.requests).toHaveLength(1);

    remoteRepository.resolveNext();
    await secondSave;

    expect(remoteRepository.savedStores.map((store) => store.users[0].name)).toEqual(["First", "Second"]);
    expect(legacyRepository.savedStore?.users[0].name).toBe("Second");
  });

  it("falls back to legacy localStorage when the backend API is unavailable", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const legacyStore = normalizeStore({
      users: [{ id: "legacy_user", name: "Legacy", email: "legacy@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(null, true);
    const legacyRepository = new MemoryLegacyRepository(legacyStore);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    const result = await repository.load();

    expect(result.source).toBe("legacy");
    expect(result.remoteAvailable).toBe(false);
    expect(result.error?.message).toBe("API unavailable");
    expect(result.persistenceStatus.status).toBe("backend_unavailable_using_local_backup");
    expect(repository.getPersistenceStatus()?.status).toBe("backend_unavailable_using_local_backup");
    expect(result.store.users[0].id).toBe("legacy_user");
    expect(warning).toHaveBeenCalled();
  });

  it("prefers a newer legacy backup over an older backend store", async () => {
    const remoteStore = normalizeStore({
      users: [{ id: "remote_user", name: "Remote", email: "remote@example.com" }],
    });
    const legacyStore = normalizeStore({
      users: [{ id: "legacy_user", name: "Legacy", email: "legacy@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(remoteStore, false, { version: 1, updatedAt: 100 });
    const legacyRepository = new MemoryLegacyRepository(legacyStore, 200);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    const result = await repository.load();

    expect(result.source).toBe("legacy");
    expect(result.migratedFromLegacy).toBe(true);
    expect(result.store.users[0].id).toBe("legacy_user");
    expect(remoteRepository.savedStore?.users[0].id).toBe("legacy_user");
  });

  it("merges and retries once when the backend rejects a stale save version", async () => {
    const remoteStore = normalizeStore({
      users: [{ id: "user_remote", name: "Remote", email: "remote@example.com", createdAt: 1, updatedAt: 1 }],
    });
    const newerRemoteStore = normalizeStore({
      users: [
        { id: "user_remote", name: "Remote", email: "remote@example.com", createdAt: 1, updatedAt: 1 },
        { id: "user_other", name: "Other", email: "other@example.com", createdAt: 2, updatedAt: 2 },
      ],
    });
    const localStore = normalizeStore({
      users: [
        { id: "user_remote", name: "Remote", email: "remote@example.com", createdAt: 1, updatedAt: 1 },
        { id: "user_local", name: "Local", email: "local@example.com", createdAt: 3, updatedAt: 3 },
      ],
    });
    const remoteRepository = new MemoryRemoteRepository(remoteStore, false, { version: 1, updatedAt: 100 });
    const legacyRepository = new MemoryLegacyRepository(null);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    await repository.load();
    remoteRepository.setRemoteSnapshot(newerRemoteStore, { version: 2, updatedAt: 200 });
    await repository.save(localStore);

    expect(remoteRepository.savedStore?.users.map((user) => user.id).sort()).toEqual([
      "user_local",
      "user_other",
      "user_remote",
    ]);
    expect(repository.getPersistenceStatus()?.status).toBe("backend_persisted");
  });

  it("keeps a legacy backup and reports save_failed_local_backup_only when backend save fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = normalizeStore({
      users: [{ id: "user_1", name: "User", email: "user@example.com" }],
    });
    const remoteRepository = new MemoryRemoteRepository(null, true);
    const legacyRepository = new MemoryLegacyRepository(null);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    await repository.save(store);

    expect(legacyRepository.savedStore?.users[0].id).toBe("user_1");
    expect(repository.getPersistenceStatus()?.status).toBe("save_failed_local_backup_only");
    expect(repository.getPersistenceStatus()?.error?.message).toBe("API unavailable");
    expect(warning).toHaveBeenCalled();
  });

  it("normalizes stores loaded from legacy localStorage before returning and migrating them", async () => {
    const legacyStore = {
      users: [{ id: "legacy_user", name: "Legacy", email: "legacy@example.com" }],
    } as Store;
    const remoteRepository = new MemoryRemoteRepository(null);
    const legacyRepository = new MemoryLegacyRepository(legacyStore);
    const repository = new HybridStoreRepository(remoteRepository, legacyRepository);

    const result = await repository.load();

    expect(result.store.schemaVersion).toBe(1);
    expect(result.store.users[0]).toMatchObject({
      id: "legacy_user",
      type: "user",
      deletedAt: null,
      schemaVersion: 1,
    });
    expect(remoteRepository.savedStore?.users[0].schemaVersion).toBe(1);
  });
});

function waitForAsyncQueue() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
