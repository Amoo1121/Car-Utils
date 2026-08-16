import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "./authRoutes.js";
import type { SQLiteAuthRepository } from "./authRepository.js";
import { StoreVersionConflictError, type SQLiteStoreRepository, type StoreRecord } from "./storeRepository.js";

export function registerStoreRoutes(
  app: FastifyInstance,
  repository: SQLiteStoreRepository,
  authRepository: SQLiteAuthRepository,
) {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/store", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, authRepository);
    if (!user) return;
    const record = repository.getStore(user.id) ?? repository.claimLegacyStore(user.id, user.email);
    if (!record) {
      return reply.code(404).send({ store: null });
    }

    setStoreVersionHeaders(reply, record);
    return record.store;
  });

  app.put("/api/store", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, authRepository);
    if (!user) return;
    try {
      const savedRecord = repository.saveStore(user.id, request.body, {
        expectedVersion: parseExpectedVersion(request.headers),
      });
      setStoreVersionHeaders(reply, savedRecord);
      return reply.code(200).send(savedRecord.store);
    } catch (error) {
      if (error instanceof StoreVersionConflictError) {
        if (error.currentRecord) setStoreVersionHeaders(reply, error.currentRecord);
        return reply.code(409).send({
          error: "STORE_VERSION_CONFLICT",
          store: error.currentRecord?.store ?? null,
          updatedAt: error.currentRecord?.updatedAt,
          version: error.currentRecord?.version,
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid store payload.",
      });
    }
  });
}

function parseExpectedVersion(headers: Record<string, string | string[] | undefined>) {
  const ifNoneMatch = readHeader(headers["if-none-match"]);
  if (ifNoneMatch?.trim() === "*") return null;

  const explicitVersion = readHeader(headers["x-car-utils-expected-version"]) ?? readHeader(headers["if-match"]);
  if (!explicitVersion) return undefined;

  const normalizedVersion = explicitVersion.trim().replace(/^"|"$/g, "");
  const version = Number(normalizedVersion);
  if (!Number.isInteger(version) || version < 0) {
    throw new TypeError("Expected store version must be a non-negative integer.");
  }

  return version;
}

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setStoreVersionHeaders(reply: { header: (name: string, value: string) => unknown }, record: StoreRecord) {
  reply.header("x-car-utils-store-version", String(record.version));
  reply.header("x-car-utils-updated-at", String(record.updatedAt));
}
