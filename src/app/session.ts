import { useCallback, useEffect, useRef, useState } from "react";
import { mergeStores, normalizeStore, emptyStore, filterActive, type Store } from "../shared/carData";
import { mergeAuthenticatedStoreSources, scopeStoreToAuthenticatedUser } from "../domain/user/authStore";
import { createAuthenticatedStoreRepository } from "../repositories/hybridStoreRepository";
import { createLocalStorageStoreRepository } from "../repositories/localStorageStoreRepository";
import { authRepository, type AuthCredentials, type AuthUser } from "../repositories/authRepository";
import type { PersistenceStatusSnapshot, StoreRepository } from "../repositories/storeRepository";

export type SessionStatus = "checking" | "signed_out" | "loading" | "ready";

const REFRESH_ON_FOCUS_AFTER_MS = 30_000;

/**
 * Owns authentication, the per-user store and its persistence.
 * `commit` always builds on the latest store via a ref, so several mutations in
 * the same tick (e.g. create product + save wash) never overwrite each other.
 */
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<Store>(() => normalizeStore(emptyStore));
  const [persistence, setPersistence] = useState<PersistenceStatusSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const storeRef = useRef(store);
  const repositoryRef = useRef<StoreRepository | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastSyncRef = useRef(0);
  const authUserRef = useRef<AuthUser | null>(null);
  authUserRef.current = authUser;

  const applyStore = useCallback((next: Store) => {
    storeRef.current = next;
    setStore(next);
  }, []);

  const initialize = useCallback(
    async (user: AuthUser, isActive: () => boolean = () => true) => {
      const repository = createAuthenticatedStoreRepository(user.id);
      unsubscribeRef.current?.();
      repositoryRef.current = repository;
      unsubscribeRef.current = repository.subscribePersistenceStatus((snapshot) => {
        if (isActive()) setPersistence(snapshot);
      });

      const result = await repository.load();
      if (!isActive()) return;
      // Data recorded before password accounts existed lives in the unscoped localStorage key.
      const legacyStore = createLocalStorageStoreRepository().loadLegacyStore();
      const merged = mergeAuthenticatedStoreSources(result.store, legacyStore, user);
      if (result.source === "empty" || merged.importedLegacy) await repository.replace(merged.store);
      lastSyncRef.current = Date.now();
      if (isActive()) applyStore(merged.store);
    },
    [applyStore],
  );

  useEffect(() => {
    let active = true;
    authRepository
      .getSession()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          setStatus("signed_out");
          return;
        }
        setAuthUser(user);
        setStatus("loading");
        await initialize(user, () => active);
        if (active) setStatus("ready");
      })
      .catch((error) => {
        console.warn("Failed to restore the Car Utils session.", error);
        if (active) setStatus("signed_out");
      });
    return () => {
      active = false;
      unsubscribeRef.current?.();
    };
  }, [initialize]);

  const commit = useCallback(
    (next: Store) => {
      applyStore(next);
      lastSyncRef.current = Date.now();
      void repositoryRef.current?.save(next);
    },
    [applyStore],
  );

  const refresh = useCallback(async () => {
    const repository = repositoryRef.current;
    const user = authUserRef.current;
    if (!repository || !user) return;
    setRefreshing(true);
    try {
      const current = storeRef.current;
      const result = await repository.load();
      // Keep anything that only exists locally (e.g. saved while the server was down).
      const next = scopeStoreToAuthenticatedUser(mergeStores(current, result.store), user);
      applyStore(next);
      if (result.remoteAvailable && hasLocalOnlyChanges(current, result.store)) {
        void repository.save(next);
      }
      lastSyncRef.current = Date.now();
    } finally {
      setRefreshing(false);
    }
  }, [applyStore]);

  // Pick up changes made on another device (e.g. the phone) when the window regains focus.
  useEffect(() => {
    if (status !== "ready") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncRef.current < REFRESH_ON_FOCUS_AFTER_MS) return;
      if (document.querySelector(".sheet-layer")) return; // never yank data from under an open editor
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh, status]);

  const authenticate = useCallback(
    async (mode: "login" | "register", credentials: AuthCredentials) => {
      const user = mode === "login" ? await authRepository.login(credentials) : await authRepository.register(credentials);
      setAuthUser(user);
      setStatus("loading");
      try {
        await initialize(user);
        setStatus("ready");
      } catch (error) {
        setAuthUser(null);
        setStatus("signed_out");
        throw error;
      }
    },
    [initialize],
  );

  const clear = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    repositoryRef.current = null;
    setAuthUser(null);
    applyStore(normalizeStore(emptyStore));
    setPersistence(null);
    setStatus("signed_out");
  }, [applyStore]);

  const logout = useCallback(async () => {
    try {
      await authRepository.logout();
    } finally {
      clear();
    }
  }, [clear]);

  const updateAuthUser = useCallback(
    (user: AuthUser) => {
      setAuthUser(user);
      commit(scopeStoreToAuthenticatedUser(storeRef.current, user));
    },
    [commit],
  );

  /** Replaces the store (import / cloud sync) while keeping it scoped to the signed-in account. */
  const replaceStore = useCallback(
    (next: Store) => {
      const user = authUserRef.current;
      const normalized = normalizeStore(next);
      const scoped = user ? scopeStoreToAuthenticatedUser(normalized, user) : normalized;
      commit(scoped);
      return scoped;
    },
    [commit],
  );

  return {
    status,
    authUser,
    store,
    storeRef,
    persistence,
    refreshing,
    commit,
    refresh,
    authenticate,
    logout,
    clear,
    updateAuthUser,
    replaceStore,
    hasActiveVehicles: filterActive(store.vehicles).length > 0,
  };
}

export type Session = ReturnType<typeof useSession>;

const collections = ["vehicles", "fuelRecords", "washRecords", "washProducts", "expenseRecords"] as const;

/** True when the local store has entities that are missing or newer than on the server. */
export function hasLocalOnlyChanges(local: Store, remote: Store) {
  return collections.some((key) => {
    const remoteItems = new Map((remote[key] as { id: string; updatedAt?: number }[]).map((item) => [item.id, item.updatedAt ?? 0]));
    return (local[key] as { id: string; updatedAt?: number }[]).some((item) => {
      const remoteUpdatedAt = remoteItems.get(item.id);
      return remoteUpdatedAt == null || (item.updatedAt ?? 0) > remoteUpdatedAt;
    });
  });
}
