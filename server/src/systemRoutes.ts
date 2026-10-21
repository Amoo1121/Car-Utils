import { networkInterfaces } from "node:os";
import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "./authRoutes.js";
import type { SQLiteAuthRepository } from "./authRepository.js";
import type { BackupManager } from "./backup.js";

export const APP_VERSION = "2.0.0";

export type SystemRouteOptions = {
  backups?: BackupManager;
  databasePath: string;
  port?: number;
  runtime: "native" | "docker" | "dev";
  startedAt?: number;
};

export function registerSystemRoutes(
  app: FastifyInstance,
  authRepository: SQLiteAuthRepository,
  options: SystemRouteOptions,
) {
  const startedAt = options.startedAt ?? Date.now();

  app.get("/api/system", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, authRepository);
    if (!user) return;

    return {
      version: APP_VERSION,
      runtime: options.runtime,
      startedAt,
      databasePath: options.databasePath,
      backupDirectory: options.backups?.directory ?? null,
      backups: (options.backups?.list() ?? []).slice(0, 10),
      lanUrls: options.port ? listLanUrls(options.port) : [],
    };
  });

  app.post("/api/system/backups", async (request, reply) => {
    const user = requireAuthenticatedUser(request, reply, authRepository);
    if (!user) return;
    if (!options.backups) return reply.code(501).send({ error: "BACKUPS_DISABLED", message: "当前运行方式未启用自动备份。" });

    try {
      return reply.code(201).send({ backup: options.backups.create("manual") });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: "BACKUP_FAILED", message: "创建备份失败。" });
    }
  });
}

function listLanUrls(port: number) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}/`);
}
