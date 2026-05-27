import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

function safePath(root: string, urlPath: string): string | null {
  const rel = urlPath.split("?")[0]!.replace(/^\//, "") || "index.html";
  const resolved = normalize(join(root, rel));
  if (!resolved.startsWith(normalize(root))) return null;
  return resolved;
}

export type StaticServerOptions = {
  /**
   * Vite build 若使用 Next embed base（如 /projects/{id}/wvp-embed/），
   * 錄製時需把該前綴剝掉再對應到 dist 根目錄。
   */
  pathPrefix?: string;
};

function mapRequestUrl(url: string | undefined, pathPrefix?: string): string {
  let p = (url ?? "/").split("?")[0] || "/";
  if (pathPrefix && p.startsWith(pathPrefix)) {
    p = `/${p.slice(pathPrefix.length).replace(/^\//, "")}`;
  }
  return p || "/";
}

/** 從 dist/index.html 推斷 embed base（供錄製靜態站使用） */
export async function detectWvpEmbedPrefix(distDir: string): Promise<string | undefined> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const html = await readFile(join(distDir, "index.html"), "utf8");
  const m = html.match(/(?:src|href)="(\/[^"]*wvp-embed\/)/);
  return m?.[1];
}

/** 本機靜態伺服器（供 Playwright 錄製 dist，無需登入 Next.js） */
export async function startStaticServer(
  rootDir: string,
  port = 0,
  opts?: StaticServerOptions,
): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const pathPrefix = opts?.pathPrefix?.endsWith("/") ? opts.pathPrefix : opts?.pathPrefix ? `${opts.pathPrefix}/` : undefined;

  const server = createServer(async (req, res) => {
    try {
      const mapped = mapRequestUrl(req.url, pathPrefix);
      let filePath = safePath(rootDir, mapped);
      if (!filePath) {
        res.writeHead(403).end();
        return;
      }
      let buf: Buffer;
      try {
        buf = await readFile(filePath);
      } catch {
        const isDocument =
          mapped === "/" || mapped.endsWith(".html") || !mapped.includes(".");
        if (!isDocument) {
          res.writeHead(404).end("Not found");
          return;
        }
        filePath = safePath(rootDir, "/index.html");
        if (!filePath) {
          res.writeHead(404).end("Not found");
          return;
        }
        buf = await readFile(filePath);
      }
      const ext = filePath.includes(".") ? filePath.slice(filePath.lastIndexOf(".")) : ".html";
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(buf);
    } catch (e) {
      res.writeHead(500).end((e as Error).message);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;

  return {
    server,
    port: boundPort,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
