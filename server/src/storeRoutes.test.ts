import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "./index.js";

function createTempDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "car-utils-server-"));
  return {
    directory,
    databasePath: join(directory, "car-utils.sqlite"),
  };
}

test("GET /api/health returns ok", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test("PUT /api/store then GET /api/store reads back the store", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const store = {
    schemaVersion: 1,
    users: [{ id: "user_1", name: "Amoo", email: "amoo@example.com" }],
    vehicles: [],
    fuelRecords: [],
    washRecords: [],
    washProducts: [],
    expenseRecords: [],
  };

  const putResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    payload: store,
  });
  const getResponse = await app.inject({ method: "GET", url: "/api/store" });

  assert.equal(putResponse.statusCode, 200);
  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(getResponse.json(), store);
});

test("SQLite database keeps data after server recreation", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const store = {
    schemaVersion: 1,
    users: [{ id: "user_1", name: "Amoo", email: "amoo@example.com" }],
    vehicles: [],
    fuelRecords: [],
    washRecords: [],
    washProducts: [],
    expenseRecords: [],
  };

  const firstApp = createServer({ databasePath, logger: false });
  await firstApp.inject({ method: "PUT", url: "/api/store", payload: store });
  await firstApp.close();

  const secondApp = createServer({ databasePath, logger: false });
  t.after(async () => secondApp.close());

  const response = await secondApp.inject({ method: "GET", url: "/api/store" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), store);
});
