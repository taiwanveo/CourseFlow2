import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

export function wvpDistStoragePrefix(userId: string, projectId: string): string {
  return `${userId}/${projectId}/wvp-dist`;
}

/** 上傳 Vite dist 至 Storage（供 Worker 遠端錄製） */
export async function uploadDistDirectory(
  upload: (storagePath: string, body: Buffer, contentType: string) => Promise<void>,
  storagePrefix: string,
  distDir: string,
): Promise<number> {
  const files = await walkFiles(distDir);
  let count = 0;
  for (const abs of files) {
    const rel = relative(distDir, abs).replace(/\\/g, "/");
    const buf = await readFile(abs);
    const ext = rel.includes(".") ? rel.slice(rel.lastIndexOf(".")) : "";
    const mime =
      ext === ".html"
        ? "text/html"
        : ext === ".js"
          ? "application/javascript"
          : ext === ".css"
            ? "text/css"
            : ext === ".mp3"
              ? "audio/mpeg"
              : "application/octet-stream";
    await upload(`${storagePrefix}/${rel}`, buf, mime);
    count++;
  }
  return count;
}

/** 從 Storage 下載 dist 至本機目錄 */
export async function downloadDistDirectory(
  download: (storagePath: string) => Promise<Buffer | null>,
  storagePrefix: string,
  destDir: string,
  manifest?: string[],
): Promise<void> {
  const paths =
    manifest ??
    (await listRemoteDistFiles(download, storagePrefix));

  for (const rel of paths) {
    const buf = await download(`${storagePrefix}/${rel}`);
    if (!buf) continue;
    const dest = join(destDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }
}

async function listRemoteDistFiles(
  download: (storagePath: string) => Promise<Buffer | null>,
  storagePrefix: string,
): Promise<string[]> {
  // 若無 manifest，至少拉 index.html；完整列表由 upload 時寫入 manifest.json
  const index = await download(`${storagePrefix}/index.html`);
  if (!index) throw new Error("找不到 wvp-dist/index.html，請先在 Studio 建置 WVP 預覽");
  return ["index.html"];
}

export async function writeDistManifest(distDir: string): Promise<string[]> {
  const files = await walkFiles(distDir);
  const rels = files.map((f) => relative(distDir, f).replace(/\\/g, "/"));
  await writeFile(
    join(distDir, "cf-dist-manifest.json"),
    `${JSON.stringify(rels, null, 2)}\n`,
  );
  return rels;
}

export async function readDistManifest(distDir: string): Promise<string[]> {
  try {
    const raw = await readFile(join(distDir, "cf-dist-manifest.json"), "utf8");
    return JSON.parse(raw) as string[];
  } catch {
    return walkFiles(distDir).then((files) =>
      files.map((f) => relative(distDir, f).replace(/\\/g, "/")),
    );
  }
}

export async function distDirectorySize(distDir: string): Promise<number> {
  let total = 0;
  for (const f of await walkFiles(distDir)) {
    const s = await stat(f);
    total += s.size;
  }
  return total;
}
