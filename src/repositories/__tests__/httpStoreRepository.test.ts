import { describe, expect, it } from "vitest";
import { HttpStoreRepository } from "../httpStoreRepository";

describe("HttpStoreRepository", () => {
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
