import type { DatabaseSync } from "node:sqlite";

const LEGACY_STORE_ID = "default";

type StoreRow = {
  payload: string;
  updated_at: number;
  version: number;
};

export type StorePayload = Record<string, unknown>;
export type StoreRecord = {
  store: StorePayload;
  updatedAt: number;
  version: number;
};

export class StoreVersionConflictError extends Error {
  constructor(readonly currentRecord: StoreRecord | null) {
    super("Store version conflict.");
    this.name = "StoreVersionConflictError";
  }
}

export class SQLiteStoreRepository {
  constructor(private readonly database: DatabaseSync) {}

  getStore(userId: string): StoreRecord | null {
    const row = this.database
      .prepare("SELECT payload, updated_at, version FROM user_stores WHERE user_id = ?")
      .get(userId) as StoreRow | undefined;

    if (!row) return null;
    const parsed = JSON.parse(row.payload) as unknown;
    return {
      store: assertStorePayload(parsed),
      updatedAt: row.updated_at,
      version: row.version,
    };
  }

  saveStore(userId: string, value: unknown, options: { expectedVersion?: number | null } = {}): StoreRecord {
    const store = assertStorePayload(value);
    const existingRecord = this.getStore(userId);
    if (options.expectedVersion === null && existingRecord) {
      throw new StoreVersionConflictError(existingRecord);
    }
    if (
      typeof options.expectedVersion === "number" &&
      (!existingRecord || existingRecord.version !== options.expectedVersion)
    ) {
      throw new StoreVersionConflictError(existingRecord);
    }

    const schemaVersion = typeof store.schemaVersion === "number" ? store.schemaVersion : null;
    const updatedAt = Date.now();
    const version = existingRecord ? existingRecord.version + 1 : 1;
    const payload = JSON.stringify(store);

    this.database
      .prepare(
        `
          INSERT INTO user_stores (user_id, schema_version, payload, updated_at, version)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            schema_version = excluded.schema_version,
            payload = excluded.payload,
            updated_at = excluded.updated_at,
            version = excluded.version
        `,
      )
      .run(userId, schemaVersion, payload, updatedAt, version);

    return {
      store,
      updatedAt,
      version,
    };
  }

  claimLegacyStore(userId: string, email: string): StoreRecord | null {
    const existingRecord = this.getStore(userId);
    if (existingRecord) return existingRecord;

    const row = this.database
      .prepare("SELECT payload FROM app_store WHERE id = ?")
      .get(LEGACY_STORE_ID) as Pick<StoreRow, "payload"> | undefined;
    if (!row) return null;

    const scopedStore = scopeLegacyStoreToEmail(assertStorePayload(JSON.parse(row.payload)), email);
    if (!scopedStore) return null;
    return this.saveStore(userId, scopedStore, { expectedVersion: null });
  }
}

function assertStorePayload(value: unknown): StorePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Store payload must be a JSON object.");
  }

  return value as StorePayload;
}

function scopeLegacyStoreToEmail(store: StorePayload, email: string): StorePayload | null {
  const users = Array.isArray(store.users) ? store.users : [];
  const localUser = users.find(
    (candidate) =>
      isRecord(candidate) && typeof candidate.email === "string" && normalizeEmail(candidate.email) === normalizeEmail(email),
  );
  if (!isRecord(localUser) || typeof localUser.id !== "string") return null;

  const userId = localUser.id;
  return {
    ...store,
    users: [localUser],
    vehicles: filterOwnedEntities(store.vehicles, userId),
    fuelRecords: filterOwnedEntities(store.fuelRecords, userId),
    washRecords: filterOwnedEntities(store.washRecords, userId),
    washProducts: filterOwnedEntities(store.washProducts, userId),
    expenseRecords: filterOwnedEntities(store.expenseRecords, userId),
    currentUserId: userId,
  };
}

function filterOwnedEntities(value: unknown, userId: string) {
  return Array.isArray(value)
    ? value.filter((candidate) => isRecord(candidate) && candidate.userId === userId)
    : [];
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
