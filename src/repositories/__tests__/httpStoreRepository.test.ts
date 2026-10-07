import { describe, expect, it, vi } from "vitest";
import { HttpStoreRepository } from "../httpStoreRepository";

describe("HttpStoreRepository", () => {
  it("bypasses browser HTTP caching when reading Store versions", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({}), {
      headers: { "x-car-utils-store-version": "7" },
    }));
    const repository = new HttpStoreRepository("", fetcher as typeof fetch);

    expect((await repository.getStore())?.version).toBe(7);
    expect(fetcher).toHaveBeenCalledWith("/api/store", expect.objectContaining({
      cache: "no-store",
      credentials: "include",
    }));
  });

  it("calls the browser fetch function without using the repository as its receiver", async () => {
    let fetchReceiver: unknown = "not-called";
    const fetcher = function (this: unknown) {
      fetchReceiver = this;
      return Promise.resolve(new Response(JSON.stringify({ store: null }), { status: 404 }));
    } as typeof fetch;
    const repository = new HttpStoreRepository("", fetcher);

    const result = await repository.getStore();

    expect(result).toBeNull();
    expect(fetchReceiver).toBeUndefined();
  });
});
