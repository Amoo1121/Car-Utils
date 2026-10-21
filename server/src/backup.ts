import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export type BackupInfo = {
  name: string;
  size: number;
  createdAt: number;
};

export type BackupManagerOptions = {
  directory: string;
  /** How many automatic snapshots to keep. Manual snapshots are kept too but count toward the limit. */
  keep?: number;
};

const BACKUP_PREFIX = "car-utils-";
const BACKUP_SUFFIX = ".sqlite";

/**
 * Consistent SQLite snapshots via `VACUUM INTO`. Snapshots are written next to
 * the live database and never replace it.
 */
export class BackupManager {
  private readonly keep: number;

  constructor(
    private readonly database: DatabaseSync,
    private readonly options: BackupManagerOptions,
  ) {
    this.keep = Math.max(options.keep ?? 30, 3);
  }

  get directory() {
    return this.options.directory;
  }

  list(): BackupInfo[] {
    try {
      return readdirSync(this.options.directory)
        .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
        .map((name) => {
          const stats = statSync(join(this.options.directory, name));
          return { name, size: stats.size, createdAt: stats.mtimeMs };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }

  create(reason: "auto" | "manual" = "manual", now = new Date()): BackupInfo {
    mkdirSync(this.options.directory, { recursive: true });
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
    const name = `${BACKUP_PREFIX}${stamp}-${reason}${BACKUP_SUFFIX}`;
    const target = join(this.options.directory, name);
    rmSync(target, { force: true });
    this.database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
    this.prune();
    const stats = statSync(target);
    return { name, size: stats.size, createdAt: stats.mtimeMs };
  }

  /** Creates an automatic snapshot when the newest one is older than `maxAgeMs`. */
  ensureRecent(maxAgeMs = 24 * 60 * 60 * 1000, now = Date.now()) {
    const latest = this.list()[0];
    if (latest && now - latest.createdAt < maxAgeMs) return null;
    return this.create("auto", new Date(now));
  }

  private prune() {
    this.list()
      .slice(this.keep)
      .forEach((backup) => rmSync(join(this.options.directory, backup.name), { force: true }));
  }
}
