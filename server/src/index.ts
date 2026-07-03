import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { openDatabase } from "./db.js";
import { SQLiteStoreRepository } from "./storeRepository.js";
import { registerStoreRoutes } from "./storeRoutes.js";

export type CreateServerOptions = {
  databasePath?: string;
  logger?: boolean;
};

export function createServer(options: CreateServerOptions = {}) {
  const database = openDatabase(options.databasePath);
  const repository = new SQLiteStoreRepository(database);
  const app = Fastify({
    logger: options.logger ?? true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    reply.header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.addHook("onClose", async () => {
    database.close();
  });

  registerStoreRoutes(app, repository);
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
