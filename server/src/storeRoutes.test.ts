import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "./db.js";
import { createServer } from "./index.js";

type TestServer = ReturnType<typeof createServer>;

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

test("GET /api/product-lookup returns reviewable metadata candidates", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({
    databasePath,
    logger: false,
    productLookup: async (query) => [
      {
        title: `${query} official`,
        description: "Automotive glass cleaner.",
        imageUrl: "https://example.com/product.jpg",
        sourceUrl: "https://example.com/product",
      },
    ],
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/product-lookup?query=Fireball%20Glass",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    query: "Fireball Glass",
    candidates: [
      {
        title: "Fireball Glass official",
        description: "Automotive glass cleaner.",
        imageUrl: "https://example.com/product.jpg",
        sourceUrl: "https://example.com/product",
      },
    ],
  });
});

test("GET /api/product-lookup validates the query", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false, productLookup: async () => [] });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/product-lookup?query=x" });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_PRODUCT_QUERY");
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

test("auth registration creates an HttpOnly session and protects the Store API", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const unauthenticatedStore = await app.inject({ method: "GET", url: "/api/store" });
  const registration = await registerTestUser(app, "admin@example.com", "Admin");
  const session = await app.inject({
    method: "GET",
    url: "/api/auth/session",
    headers: { cookie: registration.cookie },
  });

  assert.equal(unauthenticatedStore.statusCode, 401);
  assert.equal(registration.response.statusCode, 201);
  assert.match(String(registration.response.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(registration.response.headers["set-cookie"]), /SameSite=Lax/);
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().user.email, "admin@example.com");
  assert.equal(session.json().user.role, "admin");
});

test("registering with a legacy email claims only that user's existing Store data", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const legacyStore = {
    schemaVersion: 1,
    users: [
      { id: "legacy_owner", name: "Legacy Owner", email: "OWNER@example.com" },
      { id: "legacy_other", name: "Other", email: "other@example.com" },
    ],
    vehicles: [
      { id: "owner_car", userId: "legacy_owner", nickname: "Mine", deletedAt: null },
      { id: "deleted_car", userId: "legacy_owner", nickname: "Deleted", deletedAt: 100 },
      { id: "other_car", userId: "legacy_other", nickname: "Other", deletedAt: null },
    ],
    fuelRecords: [{ id: "owner_fuel", userId: "legacy_owner", vehicleId: "owner_car" }],
    washRecords: [{ id: "owner_wash", userId: "legacy_owner", vehicleId: "owner_car" }],
    washProducts: [{ id: "owner_product", userId: "legacy_owner" }],
    expenseRecords: [{ id: "owner_expense", userId: "legacy_owner", vehicleId: "owner_car" }],
    currentUserId: "legacy_other",
  };
  const database = openDatabase(databasePath);
  database
    .prepare(
      `INSERT INTO app_store (id, schema_version, payload, updated_at, version)
       VALUES ('default', 1, ?, ?, 1)`,
    )
    .run(JSON.stringify(legacyStore), Date.now());
  database.close();

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());
  const registration = await registerTestUser(app, " owner@example.com ", "New Owner");
  const response = await app.inject({
    method: "GET",
    url: "/api/store",
    headers: { cookie: registration.cookie },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().currentUserId, "legacy_owner");
  assert.deepEqual(response.json().users.map((user: { id: string }) => user.id), ["legacy_owner"]);
  assert.deepEqual(
    response.json().vehicles.map((vehicle: { id: string }) => vehicle.id),
    ["owner_car", "deleted_car"],
  );
  assert.deepEqual(response.json().fuelRecords.map((record: { id: string }) => record.id), ["owner_fuel"]);
  assert.deepEqual(response.json().washRecords.map((record: { id: string }) => record.id), ["owner_wash"]);
  assert.deepEqual(response.json().washProducts.map((record: { id: string }) => record.id), ["owner_product"]);
  assert.deepEqual(response.json().expenseRecords.map((record: { id: string }) => record.id), ["owner_expense"]);
});

test("admin can list and disable users while normal users cannot access the admin API", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());

  const admin = await registerTestUser(app, "admin@example.com", "Admin");
  const member = await registerTestUser(app, "member@example.com", "Member");
  const memberAdminResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: { cookie: member.cookie },
  });
  const adminListResponse = await app.inject({
    method: "GET",
    url: "/api/admin/users",
    headers: { cookie: admin.cookie },
  });
  const memberId = adminListResponse.json().users.find((user: { email: string }) => user.email === "member@example.com").id;
  const disableResponse = await app.inject({
    method: "PATCH",
    url: `/api/admin/users/${memberId}/status`,
    headers: { cookie: admin.cookie },
    payload: { status: "disabled" },
  });
  const disabledSession = await app.inject({
    method: "GET",
    url: "/api/auth/session",
    headers: { cookie: member.cookie },
  });

  assert.equal(memberAdminResponse.statusCode, 403);
  assert.equal(adminListResponse.statusCode, 200);
  assert.equal(adminListResponse.json().users.length, 2);
  assert.equal(disableResponse.statusCode, 200);
  assert.equal(disabledSession.statusCode, 401);
});

test("password login rejects invalid credentials and password changes revoke existing sessions", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());
  const registration = await registerTestUser(app, "owner@example.com", "Owner");

  const invalidLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "owner@example.com", password: "WrongPass123" },
  });
  const passwordChange = await app.inject({
    method: "PUT",
    url: "/api/auth/password",
    headers: { cookie: registration.cookie },
    payload: { currentPassword: "StrongPass123", newPassword: "NewStrongPass456" },
  });
  const revokedSession = await app.inject({
    method: "GET",
    url: "/api/auth/session",
    headers: { cookie: registration.cookie },
  });
  const oldPasswordLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "owner@example.com", password: "StrongPass123" },
  });
  const newPasswordLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "owner@example.com", password: "NewStrongPass456" },
  });

  assert.equal(invalidLogin.statusCode, 401);
  assert.equal(passwordChange.statusCode, 204);
  assert.equal(revokedSession.statusCode, 401);
  assert.equal(oldPasswordLogin.statusCode, 401);
  assert.equal(newPasswordLogin.statusCode, 200);
  assert.match(String(newPasswordLogin.headers["set-cookie"]), /HttpOnly/);
});

test("registered users have isolated Store payloads", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());
  const first = await registerTestUser(app, "first@example.com", "First");
  const second = await registerTestUser(app, "second@example.com", "Second");
  const firstStore = { schemaVersion: 1, users: [{ id: "first", email: "first@example.com" }] };
  const secondStore = { schemaVersion: 1, users: [{ id: "second", email: "second@example.com" }] };

  await app.inject({ method: "PUT", url: "/api/store", headers: { cookie: first.cookie }, payload: firstStore });
  await app.inject({ method: "PUT", url: "/api/store", headers: { cookie: second.cookie }, payload: secondStore });
  const firstResponse = await app.inject({ method: "GET", url: "/api/store", headers: { cookie: first.cookie } });
  const secondResponse = await app.inject({ method: "GET", url: "/api/store", headers: { cookie: second.cookie } });

  assert.deepEqual(firstResponse.json(), firstStore);
  assert.deepEqual(secondResponse.json(), secondStore);
});

test("PUT /api/store then GET /api/store reads back the store", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());
  const { cookie } = await registerTestUser(app);

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
    headers: { cookie },
    payload: store,
  });
  const getResponse = await app.inject({ method: "GET", url: "/api/store", headers: { cookie } });

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
  const { cookie } = await registerTestUser(firstApp);
  await firstApp.inject({ method: "PUT", url: "/api/store", headers: { cookie }, payload: store });
  await firstApp.close();

  const secondApp = createServer({ databasePath, logger: false });
  t.after(async () => secondApp.close());

  const response = await secondApp.inject({ method: "GET", url: "/api/store", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), store);
});

test("PUT /api/store rejects stale If-Match writes without overwriting the current store", async (t) => {
  const { directory, databasePath } = createTempDatabasePath();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const app = createServer({ databasePath, logger: false });
  t.after(async () => app.close());
  const { cookie } = await registerTestUser(app);

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

  const firstResponse = await app.inject({ method: "PUT", url: "/api/store", headers: { cookie }, payload: firstStore });
  const firstVersion = String(firstResponse.headers["x-car-utils-store-version"]);
  const secondResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-match": firstVersion, cookie },
    payload: secondStore,
  });
  const conflictResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-match": firstVersion, cookie },
    payload: staleStore,
  });
  const currentResponse = await app.inject({ method: "GET", url: "/api/store", headers: { cookie } });

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
  const { cookie } = await registerTestUser(app);

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
    headers: { "if-none-match": "*", cookie },
    payload: store,
  });
  const conflictResponse = await app.inject({
    method: "PUT",
    url: "/api/store",
    headers: { "if-none-match": "*", cookie },
    payload: store,
  });

  assert.equal(createdResponse.statusCode, 200);
  assert.equal(conflictResponse.statusCode, 409);
});

async function registerTestUser(
  app: TestServer,
  email = "amoo@example.com",
  displayName = "Amoo",
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, displayName, password: "StrongPass123" },
  });
  assert.ok(response.statusCode === 201, response.body);
  const cookie = String(response.headers["set-cookie"]).split(";")[0];
  return { response, cookie };
}
