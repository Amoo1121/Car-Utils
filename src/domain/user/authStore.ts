import { emptyStore } from "../store/constants";
import type { Store, User } from "../store/types";
import { normalizeStore } from "../store/migration";
import { mergeStores } from "../store/merge";
import { filterActive, normalizeEmail, withCreatedTimestamps, withUpdatedTimestamp } from "../store/utils";
import type { AuthUser } from "../../repositories/authRepository";

export function scopeStoreToAuthenticatedUser(value: Store | null | undefined, authUser: AuthUser) {
  const store = normalizeStore(value ?? emptyStore);
  const activeUsers = filterActive(store.users);
  const matchingUser = activeUsers.find(
    (user) => normalizeEmail(user.email) === normalizeEmail(authUser.email),
  ) ?? (activeUsers.length === 1 ? activeUsers[0] : undefined);
  const user = synchronizeLocalUser(matchingUser, authUser);

  return {
    ...store,
    users: [user],
    vehicles: store.vehicles.filter((entity) => entity.userId === user.id),
    fuelRecords: store.fuelRecords.filter((entity) => entity.userId === user.id),
    washRecords: store.washRecords.filter((entity) => entity.userId === user.id),
    washProducts: store.washProducts.filter((entity) => entity.userId === user.id),
    expenseRecords: store.expenseRecords.filter((entity) => entity.userId === user.id),
    currentUserId: user.id,
  } satisfies Store;
}

export function mergeAuthenticatedStoreSources(
  primaryValue: Store | null | undefined,
  legacyValue: Store | null | undefined,
  authUser: AuthUser,
) {
  const primaryStore = scopeStoreToAuthenticatedUser(primaryValue, authUser);
  const legacyStore = legacyValue ? normalizeStore(legacyValue) : null;
  const hasMatchingLegacyUser = legacyStore?.users.some(
    (user) => normalizeEmail(user.email) === normalizeEmail(authUser.email),
  );

  if (!legacyStore || !hasMatchingLegacyUser) {
    return { store: primaryStore, importedLegacy: false };
  }

  const scopedLegacyStore = scopeStoreToAuthenticatedUser(legacyStore, authUser);
  return {
    store: scopeStoreToAuthenticatedUser(mergeStores(primaryStore, scopedLegacyStore), authUser),
    importedLegacy: true,
  };
}

function synchronizeLocalUser(localUser: User | undefined, authUser: AuthUser): User {
  if (!localUser) {
    return withCreatedTimestamps(
      {
        id: authUser.id,
        type: "user",
        name: authUser.displayName,
        email: authUser.email,
      } satisfies User,
      authUser.createdAt,
      "migration",
    );
  }

  if (localUser.name === authUser.displayName && normalizeEmail(localUser.email) === normalizeEmail(authUser.email)) {
    return localUser;
  }

  return withUpdatedTimestamp(
    {
      ...localUser,
      name: authUser.displayName,
      email: authUser.email,
    },
    authUser.updatedAt,
  );
}
