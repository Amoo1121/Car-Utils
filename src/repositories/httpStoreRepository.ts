import { normalizeStore, type Store } from "../shared/carData";
import type { RemoteStoreRepository } from "./storeRepository";

type FetchLike = typeof fetch;

export class HttpStoreRepository implements RemoteStoreRepository {
  constructor(
    private readonly baseUrl = getDefaultApiBaseUrl(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async getStore() {
    const response = await this.fetcher(this.resolveUrl("/api/store"), {
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
    return storeValue ? normalizeStore(storeValue) : null;
  }

  async putStore(store: Store) {
    const normalizedStore = normalizeStore(store);
    const response = await this.fetcher(this.resolveUrl("/api/store"), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedStore),
    });

    if (!response.ok) {
      throw new Error(`Failed to save store to local API: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return normalizeStore(unwrapStorePayload(payload) ?? payload);
  }

  private resolveUrl(path: string) {
    const normalizedBaseUrl = this.baseUrl.replace(/\/$/, "");
    return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
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
