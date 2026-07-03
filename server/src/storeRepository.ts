import type { DatabaseSync } from "node:sqlite";

const STORE_ID = "default";

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

  getStore(): StoreRecord | null {
    const row = this.database
      .prepare("SELECT payload, updated_at, version FROM app_store WHERE id = ?")
      .get(STORE_ID) as StoreRow | undefined;

    if (!row) return null;
    const parsed = JSON.parse(row.payload) as unknown;
    return {
      store: assertStorePayload(parsed),
      updatedAt: row.updated_at,
      version: row.version,
    };
  }

  saveStore(value: unknown, options: { expectedVersion?: number | null } = {}): StoreRecord {
    const store = assertStorePayload(value);
    const existingRecord = this.getStore();
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
          INSERT INTO app_store (id, schema_version, payload, updated_at, version)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            schema_version = excluded.schema_version,
            payload = excluded.payload,
            updated_at = excluded.updated_at,
            version = excluded.version
        `,
      )
      .run(STORE_ID, schemaVersion, payload, updatedAt, version);

    return {
      store,
      updatedAt,
      version,
    };
  }
}

function assertStorePayload(value: unknown): StorePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Store payload must be a JSON object.");
  }

  return value as StorePayload;
}
