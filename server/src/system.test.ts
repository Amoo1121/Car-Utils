import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { BackupManager } from "./backup.js";
import { openDatabase } from "./db.js";
import { createServer } from "./index.js";

function createTempDirectory() {
  return mkdtempSync(join(tmpdir(), "car-utils-system-"));
}

async function register(app: ReturnType<typeof createServer>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "system@example.com", displayName: "System", password: "password-123" },
  });
  const cookie = String(response.headers["set-cookie"]).split(";")[0];
  return cookie;
}

test("static hosting serves files, falls back to index.html and never escapes the root", async (t) => {
  const directory = createTempDirectory();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const staticDir = join(directory, "web");
  mkdirSync(join(staticDir, "assets"), { recursive: true });
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>Car Utils</title>");
  writeFileSync(join(staticDir, "assets", "app-abc.js"), "console.log(1)");
  writeFileSync(join(directory, "secret.txt"), "top secret");

  const app = createServer({ databasePath: join(directory, "db.sqlite"), logger: false, staticDir });
  t.after(async () => app.close());

  const index = await app.inject({ method: "GET", url: "/" });
  assert.equal(index.statusCode, 200);
  assert.match(index.body, /Car Utils/);
  assert.equal(index.headers["cache-control"], "no-cache");

  const asset = await app.inject({ method: "GET", url: "/assets/app-abc.js" });
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers["content-type"]), /javascript/);
  assert.match(String(asset.headers["cache-control"]), /immutable/);

  const deepLink = await app.inject({ method: "GET", url: "/timeline/anything" });
  assert.equal(deepLink.statusCode, 200);
  assert.match(deepLink.body, /Car Utils/);

  const traversal = await app.inject({ method: "GET", url: "/%2e%2e/secret.txt" });
  assert.doesNotMatch(traversal.body, /top secret/);

  const missingApi = await app.inject({ method: "GET", url: "/api/does-not-exist" });
  assert.equal(missingApi.statusCode, 404);
  assert.equal(missingApi.json().error, "NOT_FOUND");
});

test("backup manager writes consistent snapshots and prunes old ones", (t) => {
  const directory = createTempDirectory();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const database = openDatabase(join(directory, "db.sqlite"));
  t.after(() => database.close());
  database.prepare("INSERT INTO app_store (id, payload, updated_at) VALUES ('default', '{\"ok\":true}', 1)").run();

  const backups = new BackupManager(database, { directory: join(directory, "backups"), keep: 3 });
  for (let index = 0; index < 5; index += 1) {
    backups.create("manual", new Date(Date.UTC(2026, 0, 1, 0, 0, index)));
  }

  const files = readdirSync(join(directory, "backups"));
  assert.equal(files.length, 3);

  const snapshot = new DatabaseSync(join(directory, "backups", backups.list()[0].name));
  const row = snapshot.prepare("SELECT payload FROM app_store WHERE id = 'default'").get() as { payload: string };
  snapshot.close();
  assert.equal(row.payload, '{"ok":true}');

  assert.equal(backups.ensureRecent(), null, "a fresh backup should not be duplicated");
});

test("system endpoint requires authentication and reports runtime details", async (t) => {
  const directory = createTempDirectory();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = createServer({
    databasePath: join(directory, "db.sqlite"),
    backupDir: join(directory, "backups"),
    logger: false,
    port: 4173,
    runtime: "native",
  });
  t.after(async () => app.close());
  await app.ready();

  const anonymous = await app.inject({ method: "GET", url: "/api/system" });
  assert.equal(anonymous.statusCode, 401);

  const cookie = await register(app);
  const system = await app.inject({ method: "GET", url: "/api/system", headers: { cookie } });
  assert.equal(system.statusCode, 200);
  const body = system.json();
  assert.equal(body.runtime, "native");
  assert.ok(body.backups.length >= 1, "startup should create an automatic backup");

  const manual = await app.inject({ method: "POST", url: "/api/system/backups", headers: { cookie } });
  assert.equal(manual.statusCode, 201);
  assert.match(manual.json().backup.name, /manual/);
});
