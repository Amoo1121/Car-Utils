import { describe, expect, it, vi } from "vitest";
import { lookupWashProductMetadata } from "../productLookup";

describe("lookupWashProductMetadata", () => {
  it("loads typed lookup candidates from the local backend", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          query: "Fireball Glass",
          candidates: [
            {
              title: "Fireball Glass 500ml",
              description: "Glass cleaner.",
              imageUrl: "https://example.com/glass.jpg",
              sourceUrl: "https://example.com/glass",
              category: "玻璃清洁",
              capacity: 500,
              capacityUnit: "ml",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(lookupWashProductMetadata("Fireball Glass", fetcher, "http://localhost:3001")).resolves.toEqual([
      expect.objectContaining({ title: "Fireball Glass 500ml" }),
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3001/api/product-lookup?query=Fireball%20Glass",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses the backend error message when lookup is unavailable", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ message: "暂时无法联网查找产品资料。" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(lookupWashProductMetadata("KLCB A14", fetcher, "")).rejects.toThrow("暂时无法联网查找产品资料");
  });
});
