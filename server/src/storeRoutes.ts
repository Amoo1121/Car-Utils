import type { FastifyInstance } from "fastify";
import type { SQLiteStoreRepository } from "./storeRepository.js";

export function registerStoreRoutes(app: FastifyInstance, repository: SQLiteStoreRepository) {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/store", async (_request, reply) => {
    const store = repository.getStore();
    if (!store) {
      return reply.code(404).send({ store: null });
    }

    return store;
  });

  app.put("/api/store", async (request, reply) => {
    try {
      const savedStore = repository.saveStore(request.body);
      return reply.code(200).send(savedStore);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid store payload.",
      });
    }
  });
}
