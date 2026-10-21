import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { FastifyInstance } from "fastify";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Serves the built web app from the same origin as the API so a single
 * process is enough to run Car Utils. Unknown non-API paths fall back to
 * index.html for client-side routing.
 */
export function registerStaticRoutes(app: FastifyInstance, staticDir: string) {
  const root = resolve(staticDir);
  const indexPath = join(root, "index.html");

  app.setNotFoundHandler((request, reply) => {
    const url = new URL(request.url, "http://localhost");
    const isReadRequest = request.method === "GET" || request.method === "HEAD";
    if (!isReadRequest || url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return reply.code(404).send({ error: "NOT_FOUND", message: `Route ${request.method}:${url.pathname} not found` });
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return reply.code(400).send({ error: "BAD_PATH" });
    }

    const candidate = normalize(join(root, pathname));
    const insideRoot = candidate === root || candidate.startsWith(root + sep);
    const filePath = insideRoot && isFile(candidate) ? candidate : indexPath;

    if (!existsSync(filePath)) {
      return reply.code(503).type("text/plain; charset=utf-8").send("Car Utils 前端尚未构建，请运行 npm run build。");
    }

    const extension = extname(filePath).toLowerCase();
    const isShell = filePath === indexPath || filePath.endsWith(`${sep}sw.js`) || extension === ".webmanifest";
    const isHashedAsset = filePath.includes(`${sep}assets${sep}`);
    reply.header(
      "Cache-Control",
      isShell ? "no-cache" : isHashedAsset ? "public, max-age=31536000, immutable" : "public, max-age=86400",
    );
    reply.type(contentTypes[extension] ?? "application/octet-stream");
    return reply.send(createReadStream(filePath));
  });
}

function isFile(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
