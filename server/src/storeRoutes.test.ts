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

test("OPTIONS /api/store exposes version and optimistic-lock headers", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const response = await app.inject({ method: "OPTIONS", url: "/api/store" });

  assert.equal(response.statusCode, 204);
  assert.match(String(response.headers["access-control-allow-headers"]), /If-Match/);
  assert.match(String(response.headers["access-control-allow-headers"]), /If-None-Match/);
  assert.match(String(response.headers["access-control-expose-headers"]), /X-Car-Utils-Store-Version/);
  assert.match(String(response.headers["access-control-expose-headers"]), /X-Car-Utils-Updated-At/);
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
  assert.equal(putResponse.headers["x-car-utils-store-version"], "1");
  assert.equal(getResponse.headers["x-car-utils-store-version"], "1");
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

test("PUT /api/store rejects stale If-Match writes without overwriting the current store", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const firstStore = {
    schemaVersion: 1,
    users: [{ id: "user_1", name: "First", email: "first@example.com" }],
    vehicles: [],
    fuelRecords: [],
    washRecords: [],
    washProducts: [],
    expenseRecords: [],
  };
  const secondStore = {
    ...firstStore,
    users: [{ id: "user_1", name: "Second", email: "second@example.com" }],
  };
  const staleStore = {
    ...firstStore,
    users: [{ id: "user_1", name: "Stale", email: "stale@example.com" }],
  };

  const firstResponse = await app.inject({ method: "PUT", url: "/api/store", payload: firstStore });
  const firstVersion = String(firstResponse.headers["x-car-utils-store-version"]);
  const secondResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-match": firstVersion },
    payload: secondStore,
  });
  const conflictResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-match": firstVersion },
    payload: staleStore,
  });
  const currentResponse = await app.inject({ method: "GET", url: "/api/store" });

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.headers["x-car-utils-store-version"], "2");
  assert.equal(conflictResponse.statusCode, 409);
  assert.equal(conflictResponse.json().error, "STORE_VERSION_CONFLICT");
  assert.equal(conflictResponse.headers["x-car-utils-store-version"], "2");
  assert.deepEqual(currentResponse.json(), secondStore);
});

test("PUT /api/store supports If-None-Match for empty-store creation", async (t) => {
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

  const createdResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-none-match": "*" },
    payload: store,
  });
  const conflictResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-none-match": "*" },
    payload: store,
  });

  assert.equal(createdResponse.statusCode, 200);
  assert.equal(conflictResponse.statusCode, 409);
});
