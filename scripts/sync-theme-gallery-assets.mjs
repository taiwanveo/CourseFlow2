import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "apps", "web", "public", "assets", "theme-gallery");
const baseUrl = "https://cdn.jsdelivr.net/gh/ConardLi/assets@main/imgs/web-video";
const force = process.argv.includes("--force");

const themeIds = [
  "midnight-press",
  "dark-botanical",
  "chalk-garden",
  "blueprint",
  "terminal-green",
  "neon-cyber",
  "bold-signal",
  "creative-voltage",
  "paper-press",
  "newsroom",
  "monochrome-print",
  "vintage-editorial",
  "sunset-zine",
  "pastel-dream",
  "warm-keynote",
  "electric-studio",
  "bauhaus-bold",
  "swiss-ikb",
  "dune",
  "indigo-porcelain",
  "forest-ink",
  "kraft-paper",
  "split-canvas",
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadOne(id) {
  const fileName = `${id}.webp`;
  const target = join(outDir, fileName);
  if (!force && (await exists(target))) {
    return { id, status: "cached" };
  }

  const url = `${baseUrl}/${fileName}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { id, status: "failed", error: `HTTP ${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buf);
  return { id, status: "downloaded", bytes: buf.length };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const results = [];
  for (const id of themeIds) {
    // eslint-disable-next-line no-await-in-loop
    const r = await downloadOne(id);
    results.push(r);
    if (r.status === "failed") {
      console.error(`[theme-gallery] ${id} 失敗: ${r.error}`);
    } else if (r.status === "downloaded") {
      console.log(`[theme-gallery] ${id} 已下載 (${r.bytes} bytes)`);
    } else {
      console.log(`[theme-gallery] ${id} 已快取`);
    }
  }

  const summary = results.reduce(
    (acc, r) => {
      if (r.status === "downloaded") acc.downloaded += 1;
      else if (r.status === "cached") acc.cached += 1;
      else acc.failed += 1;
      return acc;
    },
    { downloaded: 0, cached: 0, failed: 0 },
  );
  console.log(`[theme-gallery] 完成: 下載 ${summary.downloaded}, 快取 ${summary.cached}, 失敗 ${summary.failed}`);

  if (summary.failed > 0) process.exitCode = 1;
}

await main();
