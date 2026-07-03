import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeStore, type Store } from "../../shared/carData";
import { HybridStoreRepository } from "../hybridStoreRepository";
import type { LegacyStoreRepository, RemoteStoreRepository } from "../storeRepository";

class MemoryRemoteRepository implements RemoteStoreRepository {
  savedStore: Store | null = null;

  constructor(
    private readonly store: Store | null,
    private readonly shouldFail = false,
  ) {}

  async getStore() {
    if (this.shouldFail) throw new Error("API unavailable");
    return this.store;
  }

  async putStore(store: Store) {
    if (this.shouldFail) throw new Error("API unavailable");
    this.savedStore = normalizeStore(store);
    return this.savedStore;
  }
}

class MemoryLegacyRepository implements LegacyStoreRepository {
  savedStore: Store | null = null;

  constructor(private readonly store: Store | null) {}

  loadLegacyStore() {
    return this.store;
  }

  saveLegacyStore(store: Store) {
    this.savedStore = normalizeStore(store);
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
    expect(legacyRepository.savedStore).toBeNull();
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
