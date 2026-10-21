import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { SQLiteAuthRepository } from "./authRepository.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { BackupManager } from "./backup.js";
import { openDatabase, resolveDatabasePath } from "./db.js";
import { lookupProductMetadata, type ProductLookup } from "./productLookup.js";
import { registerProductLookupRoutes } from "./productLookupRoutes.js";
import { registerStaticRoutes } from "./staticRoutes.js";
import { SQLiteStoreRepository } from "./storeRepository.js";
import { registerStoreRoutes } from "./storeRoutes.js";
import { registerSystemRoutes } from "./systemRoutes.js";

export type CreateServerOptions = {
  databasePath?: string;
  logger?: boolean;
  productLookup?: ProductLookup;
  /** Directory with the built web app. When set, the server also hosts the frontend. */
  staticDir?: string;
  /** Directory for automatic SQLite snapshots. Disabled when omitted. */
  backupDir?: string;
  port?: number;
  runtime?: "native" | "docker" | "dev";
};

export function createServer(options: CreateServerOptions = {}) {
  const databasePath = options.databasePath ?? resolveDatabasePath();
  const database = openDatabase(databasePath);
  const repository = new SQLiteStoreRepository(database);
  const authRepository = new SQLiteAuthRepository(database);
  const backups = options.backupDir ? new BackupManager(database, { directory: options.backupDir }) : undefined;
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 20 * 1024 * 1024,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const configuredOrigin = process.env.CORS_ORIGIN;
    if (configuredOrigin && request.headers.origin === configuredOrigin) {
      reply.header("Access-Control-Allow-Origin", configuredOrigin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Vary", "Origin");
    }
    reply.header("Access-Control-Allow-Headers", "Content-Type, If-Match, If-None-Match, X-Car-Utils-Expected-Version");
    reply.header("Access-Control-Allow-Methods", "GET,PUT,POST,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Expose-Headers", "X-Car-Utils-Store-Version, X-Car-Utils-Updated-At");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  let backupTimer: NodeJS.Timeout | undefined;
  if (backups) {
    const runBackup = () => {
      try {
        backups.ensureRecent();
      } catch (error) {
        app.log.error(error, "Automatic SQLite backup failed");
      }
    };
    app.addHook("onReady", async () => {
      runBackup();
      backupTimer = setInterval(runBackup, 60 * 60 * 1000);
      backupTimer.unref();
    });
  }

  app.addHook("onClose", async () => {
    if (backupTimer) clearInterval(backupTimer);
    database.close();
  });

  registerAuthRoutes(app, authRepository);
  registerStoreRoutes(app, repository, authRepository);
  registerProductLookupRoutes(app, options.productLookup ?? lookupProductMetadata);
  registerSystemRoutes(app, authRepository, {
    backups,
    databasePath,
    port: options.port,
    runtime: options.runtime ?? "dev",
  });
  if (options.staticDir) registerStaticRoutes(app, options.staticDir);
  return app;
}

function resolveStaticDir() {
  if (process.env.CAR_UTILS_STATIC_DIR === "") return undefined;
  if (process.env.CAR_UTILS_STATIC_DIR) return resolve(process.env.CAR_UTILS_STATIC_DIR);
  // server/dist/index.js -> <project>/dist
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");
}

async function start() {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "0.0.0.0";
  const databasePath = resolveDatabasePath();
  const backupDir = process.env.CAR_UTILS_BACKUP_DIR || join(dirname(databasePath), "backups");
  const runtime = (process.env.CAR_UTILS_RUNTIME as CreateServerOptions["runtime"]) || "dev";
  const app = createServer({ databasePath, backupDir, port, runtime, staticDir: resolveStaticDir() });

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void start();
}
