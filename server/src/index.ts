import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { SQLiteAuthRepository } from "./authRepository.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { openDatabase } from "./db.js";
import { lookupProductMetadata, type ProductLookup } from "./productLookup.js";
import { registerProductLookupRoutes } from "./productLookupRoutes.js";
import { SQLiteStoreRepository } from "./storeRepository.js";
import { registerStoreRoutes } from "./storeRoutes.js";

export type CreateServerOptions = {
  databasePath?: string;
  logger?: boolean;
  productLookup?: ProductLookup;
};

export function createServer(options: CreateServerOptions = {}) {
  const database = openDatabase(options.databasePath);
  const repository = new SQLiteStoreRepository(database);
  const authRepository = new SQLiteAuthRepository(database);
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.addHook("onRequest", async (request, reply) => {
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

  app.addHook("onClose", async () => {
    database.close();
  });

  registerAuthRoutes(app, authRepository);
  registerStoreRoutes(app, repository, authRepository);
  registerProductLookupRoutes(app, options.productLookup ?? lookupProductMetadata);
  return app;
}

async function start() {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "0.0.0.0";
  const app = createServer();

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
