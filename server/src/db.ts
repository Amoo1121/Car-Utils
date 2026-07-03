import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function resolveDatabasePath() {
  return process.env.CAR_UTILS_DB_PATH || resolve(process.cwd(), "data", "car-utils.sqlite");
}

export function openDatabase(databasePath = resolveDatabasePath()) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      id TEXT PRIMARY KEY,
      schema_version INTEGER,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
  `);
  ensureStoreVersionColumn(database);

  return database;
}

function ensureStoreVersionColumn(database: DatabaseSync) {
  const columns = database.prepare("PRAGMA table_info(app_store)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "version")) {
    database.exec("ALTER TABLE app_store ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  }
}
