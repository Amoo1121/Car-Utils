import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
const origin = "http://localhost:4173";

function createWorker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue(["car-utils-pwa-v1", "car-utils-pwa-v2", "another-app"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetcher = vi.fn().mockResolvedValue(new Response("asset"));
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(workerSource, {
    URL,
    caches,
    fetch: fetcher,
    self: {
      registration: { scope: `${origin}/` },
      location: { origin },
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim },
    },
  });
  return { listeners, caches, cache, fetcher, claim };
}

describe("production service worker", () => {
  it.each(["/api/store", "/api/auth/session", "/api/admin/users", "/api/health", "/api/product-lookup?query=GS"])(
    "never serves %s from an offline cache",
    (path) => {
      const worker = createWorker();
      worker.caches.match.mockResolvedValue(new Response("stale private data"));
      const respondWith = vi.fn();

      worker.listeners.get("fetch")!({ request: new Request(`${origin}${path}`), respondWith });

      expect(respondWith).not.toHaveBeenCalled();
      expect(worker.caches.match).not.toHaveBeenCalled();
      expect(worker.caches.open).not.toHaveBeenCalled();
    },
  );

  it("removes old Car Utils caches on upgrade without deleting unrelated caches", async () => {
    const worker = createWorker();
    const waitUntil = vi.fn();
    worker.listeners.get("activate")!({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(worker.caches.delete).toHaveBeenCalledExactlyOnceWith("car-utils-pwa-v1");
    expect(worker.claim).toHaveBeenCalledOnce();
  });

  it("still serves static assets offline", async () => {
    const worker = createWorker();
    const asset = new Response("cached script");
    worker.caches.match.mockResolvedValue(asset);
    const respondWith = vi.fn();
    worker.listeners.get("fetch")!({ request: new Request(`${origin}/assets/index-test.js`), respondWith });

    await expect(respondWith.mock.calls[0][0]).resolves.toBe(asset);
    expect(worker.fetcher).not.toHaveBeenCalled();
  });

  it("uses the app shell only when navigation fails offline", async () => {
    const worker = createWorker();
    const shell = new Response("offline shell");
    worker.fetcher.mockRejectedValue(new TypeError("offline"));
    worker.caches.match.mockResolvedValue(shell);
    const respondWith = vi.fn();
    worker.listeners.get("fetch")!({
      request: { url: `${origin}/`, method: "GET", mode: "navigate" },
      respondWith,
    });

    await expect(respondWith.mock.calls[0][0]).resolves.toBe(shell);
    expect(worker.caches.match).toHaveBeenCalledWith(`${origin}/index.html`);
  });

  it.each([
    { url: `${origin}/api/store`, method: "PUT" },
    { url: "https://example.com/api/store", method: "GET" },
  ])("leaves $method $url to the browser network", (input) => {
    const worker = createWorker();
    const respondWith = vi.fn();
    worker.listeners.get("fetch")!({ request: new Request(input.url, { method: input.method }), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
});
