export type SystemInfo = {
  version: string;
  runtime: "native" | "docker" | "dev";
  startedAt: number;
  databasePath: string;
  backupDirectory: string | null;
  backups: { name: string; size: number; createdAt: number }[];
  lanUrls: string[];
};

function baseUrl() {
  return (import.meta.env.VITE_CAR_UTILS_API_BASE_URL ?? "").replace(/\/$/, "");
}

export async function fetchSystemInfo(): Promise<SystemInfo | null> {
  try {
    const response = await fetch(`${baseUrl()}/api/system`, { credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as SystemInfo;
  } catch {
    return null;
  }
}

export async function createServerBackup() {
  const response = await fetch(`${baseUrl()}/api/system/backups`, { method: "POST", credentials: "include", cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; backup?: SystemInfo["backups"][number] };
  if (!response.ok) throw new Error(payload.message ?? "创建备份失败");
  return payload.backup!;
}
