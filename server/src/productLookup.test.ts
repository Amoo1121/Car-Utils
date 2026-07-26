import assert from "node:assert/strict";
import test from "node:test";
import { lookupProductMetadata } from "./productLookup.js";

test("lookupProductMetadata enriches search results with Open Graph product metadata", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("https://html.duckduckgo.com/html/")) {
      return htmlResponse(`
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbrand.example%2Fglass-cleaner">
            Fireball Glass Cleaner
          </a>
          <a class="result__snippet">Fireball automotive glass cleaner 500ml.</a>
        </div>
      `);
    }

    return htmlResponse(
      `
        <html>
          <head>
            <meta property="og:title" content="Fireball Glass 500ml">
            <meta property="og:description" content="Streak-free automotive glass cleaner.">
            <meta property="og:image" content="http://brand.example/images/glass.jpg">
          </head>
        </html>
      `,
      "https://brand.example/glass-cleaner",
    );
  }) as typeof fetch;

  const candidates = await lookupProductMetadata("Fireball Glass", fetcher);

  assert.deepEqual(candidates, [
    {
      title: "Fireball Glass 500ml",
      description: "Streak-free automotive glass cleaner.",
      imageUrl: "https://brand.example/images/glass.jpg",
      sourceUrl: "https://brand.example/glass-cleaner",
      category: "玻璃清洁",
      capacity: 500,
      capacityUnit: "ml",
    },
  ]);
});

test("lookupProductMetadata keeps the search summary when a product page is unavailable", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("https://html.duckduckgo.com/html/")) {
      return htmlResponse(`
        <div class="result">
          <a class="result__a" href="https://shop.example/products/a14">KLCB A14 Glass Polish</a>
          <a class="result__snippet">Cerium oxide oil-film remover, 150ml.</a>
        </div>
      `);
    }

    return new Response("Unavailable", { status: 503 });
  }) as typeof fetch;

  const candidates = await lookupProductMetadata("KLCB A14", fetcher);

  assert.deepEqual(candidates, [
    {
      title: "KLCB A14 Glass Polish",
      description: "Cerium oxide oil-film remover, 150ml.",
      sourceUrl: "https://shop.example/products/a14",
      category: "玻璃去油膜",
      capacity: 150,
      capacityUnit: "ml",
    },
  ]);
});

test("lookupProductMetadata does not follow product redirects to private addresses", async () => {
  let privateAddressRequested = false;
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("https://html.duckduckgo.com/html/")) {
      return htmlResponse(`
        <div class="result">
          <a class="result__a" href="https://public.example/product">Safe Product</a>
          <a class="result__snippet">Automotive cleaner.</a>
        </div>
      `);
    }
    if (url === "https://public.example/product") {
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    }

    privateAddressRequested = true;
    return htmlResponse("<title>Private page</title>");
  }) as typeof fetch;

  const candidates = await lookupProductMetadata("Safe Product", fetcher);

  assert.equal(privateAddressRequested, false);
  assert.equal(candidates[0]?.sourceUrl, "https://public.example/product");
  assert.equal(candidates[0]?.imageUrl, undefined);
});

function htmlResponse(html: string, url?: string) {
  const response = new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  if (url) {
    Object.defineProperty(response, "url", { value: url });
  }
  return response;
}
