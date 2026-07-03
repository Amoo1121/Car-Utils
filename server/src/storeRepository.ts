import type { DatabaseSync } from "node:sqlite";

const STORE_ID = "default";

type StoreRow = {
  payload: string;
};

export type StorePayload = Record<string, unknown>;

export class SQLiteStoreRepository {
  constructor(private readonly database: DatabaseSync) {}

  getStore() {
    const row = this.database
      .prepare("SELECT payload FROM app_store WHERE id = ?")
      .get(STORE_ID) as StoreRow | undefined;

    if (!row) return null;
    const parsed = JSON.parse(row.payload) as unknown;
    return assertStorePayload(parsed);
  }

  saveStore(value: unknown) {
    const store = assertStorePayload(value);
    const schemaVersion = typeof store.schemaVersion === "number" ? store.schemaVersion : null;
    const updatedAt = Date.now();
    const payload = JSON.stringify(store);

    this.database
      .prepare(
        `
          INSERT INTO app_store (id, schema_version, payload, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            schema_version = excluded.schema_version,
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `,
      )
      .run(STORE_ID, schemaVersion, payload, updatedAt);

    return store;
  }
}

function assertStorePayload(value: unknown): StorePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Store payload must be a JSON object.");
  }

  return value as StorePayload;
}
