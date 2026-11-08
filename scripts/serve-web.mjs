// Minimal static file server for a Flutter release web build.
// Usage: node scripts/serve-web.mjs <dir> <port>
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3] ?? 4101);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".bin": "application/octet-stream",
  ".symbols": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let filePath = join(root, normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));

  if (!filePath.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`);
});
