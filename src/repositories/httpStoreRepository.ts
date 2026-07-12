import { normalizeStore, type Store } from "../shared/carData";
import type { PutStoreOptions, RemoteStoreRepository, RemoteStoreSnapshot } from "./storeRepository";

type FetchLike = typeof fetch;

export class StoreVersionConflictError extends Error {
  constructor(readonly remoteSnapshot: RemoteStoreSnapshot | null) {
    super("Remote store version conflict.");
    this.name = "StoreVersionConflictError";
  }
}

export class HttpStoreRepository implements RemoteStoreRepository {
  constructor(
    private readonly baseUrl = getDefaultApiBaseUrl(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async getStore() {
    const response = await this.request(this.resolveUrl("/api/store"), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to load store from local API: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const storeValue = unwrapStorePayload(payload);
    return storeValue
      ? {
          store: normalizeStore(storeValue),
          ...readStoreMetadata(response),
        }
      : null;
  }

  async putStore(store: Store, options: PutStoreOptions = {}) {
    const normalizedStore = normalizeStore(store);
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    if (typeof options.expectedVersion === "number") {
      headers.set("If-Match", String(options.expectedVersion));
    } else if (options.expectedVersion === null) {
      headers.set("If-None-Match", "*");
    }

    const response = await this.request(this.resolveUrl("/api/store"), {
      method: "PUT",
      headers,
      body: JSON.stringify(normalizedStore),
    });

    if (response.status === 409) {
      throw new StoreVersionConflictError(await readConflictSnapshot(response));
    }
    if (!response.ok) {
      throw new Error(`Failed to save store to local API: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return {
      store: normalizeStore(unwrapStorePayload(payload) ?? payload),
      ...readStoreMetadata(response),
    };
  }

  private resolveUrl(path: string) {
    const normalizedBaseUrl = this.baseUrl.replace(/\/$/, "");
    return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
  }

  private request(input: RequestInfo | URL, init?: RequestInit) {
    const fetcher = this.fetcher;
    return fetcher(input, init);
  }
}

export function createHttpStoreRepository(baseUrl?: string, fetcher?: FetchLike) {
  return new HttpStoreRepository(baseUrl, fetcher);
}

function getDefaultApiBaseUrl() {
  return import.meta.env.VITE_CAR_UTILS_API_BASE_URL ?? "";
}

function unwrapStorePayload(payload: unknown) {
  if (payload && typeof payload === "object" && "store" in payload) {
    return (payload as { store?: unknown }).store ?? null;
  }

  return payload;
}

async function readConflictSnapshot(response: Response): Promise<RemoteStoreSnapshot | null> {
  try {
    const payload = (await response.json()) as unknown;
    const storeValue = unwrapStorePayload(payload);
    return storeValue
      ? {
          store: normalizeStore(storeValue),
          ...readStoreMetadata(response, payload),
        }
      : null;
  } catch {
    return null;
  }
}

function readStoreMetadata(response: Response, payload?: unknown) {
  const payloadRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const version = parseIntegerHeader(response.headers.get("x-car-utils-store-version")) ?? parsePayloadInteger(payloadRecord.version);
  const updatedAt = parseIntegerHeader(response.headers.get("x-car-utils-updated-at")) ?? parsePayloadInteger(payloadRecord.updatedAt);

  return {
    ...(version == null ? {} : { version }),
    ...(updatedAt == null ? {} : { updatedAt }),
  };
}

function parseIntegerHeader(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parsePayloadInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
