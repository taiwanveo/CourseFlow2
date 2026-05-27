/**
 * 從 BananaX 官網 zh JSON 產生 CourseFlow 生圖風格目錄，並下載預覽圖至本機 public/。
 *
 * 用法：
 *   node scripts/build-bananax-catalog.mjs           # 更新 JSON + 下載缺漏圖片
 *   node scripts/build-bananax-catalog.mjs --force   # 強制重新下載全部圖片
 *   node scripts/build-bananax-catalog.mjs --skip-download  # 僅更新 JSON（路徑仍指向本機）
 *
 * 輸出：
 *   apps/web/public/data/bananax-zh-catalog.json
 *   apps/web/public/image-styles/bananax/thumbs/{id}.webp
 *   apps/web/public/image-styles/bananax/modals/{id}.webp
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const REMOTE_BASE =
  "https://furoku.github.io/bananaX/projects/infographic-evaluation/";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = join(ROOT, "apps/web/public/data/bananax-zh-catalog.json");
const ASSETS_ROOT = join(ROOT, "apps/web/public/image-styles/bananax");
const THUMBS_DIR = join(ASSETS_ROOT, "thumbs");
const MODALS_DIR = join(ASSETS_ROOT, "modals");

const args = new Set(process.argv.slice(2));
const SKIP_DOWNLOAD = args.has("--skip-download");
const FORCE_DOWNLOAD = args.has("--force");
const CONCURRENCY = 12;

function remoteThumbUrl(id, imgPath) {
  if (id.startsWith("biz_") || imgPath?.includes("business")) {
    const base = imgPath?.replace(/\.(png|webp)$/, "") ?? id;
    const name = base.split("/").pop();
    return `${REMOTE_BASE}assets/images/business-v2-thumb/zh/${name}.webp`;
  }
  if (/^nano_\d+$/.test(id)) {
    return `${REMOTE_BASE}assets/images/general-v2-thumb/ja/${id}.webp`;
  }
  const rel = imgPath
    ?.replace(/general-v2\//, "general-v2-thumb/")
    .replace(/\.png$/, ".webp");
  return rel ? `${REMOTE_BASE}${rel.replace(/^\//, "")}` : null;
}

function remoteModalUrl(id) {
  if (id.startsWith("biz_")) {
    return `${REMOTE_BASE}assets/images/business-v2-modal/zh/${id}.webp`;
  }
  return `${REMOTE_BASE}assets/images/general-v2-modal/ja/${id}.webp`;
}

function localThumbPath(id) {
  return `/image-styles/bananax/thumbs/${id}.webp`;
}

function localModalPath(id) {
  return `/image-styles/bananax/modals/${id}.webp`;
}

function localThumbFile(id) {
  return join(THUMBS_DIR, `${id}.webp`);
}

function localModalFile(id) {
  return join(MODALS_DIR, `${id}.webp`);
}

async function fetchJson(path) {
  const res = await fetch(REMOTE_BASE + path);
  if (!res.ok) throw new Error(`Failed ${path}: ${res.status}`);
  return res.json();
}

function normalizeEntry(raw, source) {
  const id = raw.id ?? raw.style_id;
  if (!id || !raw.yaml?.trim()) return null;
  const img = raw.img ?? raw.image;
  const remoteThumb = remoteThumbUrl(id, img) ?? remoteModalUrl(id);
  const remoteModal = remoteModalUrl(id);
  return {
    id,
    number: raw.number ?? raw.style_number ?? null,
    titleZh: raw.name_zh ?? raw.name ?? raw.title ?? id,
    titleEn: raw.name_en ?? (raw.name?.match(/[A-Za-z]/) ? raw.name : null),
    score: raw.total ?? raw.score ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    thumbnailUrl: localThumbPath(id),
    previewUrl: localModalPath(id),
    stylePromptZh: raw.yaml.trim(),
    source: "bananax-infographic-evaluation",
    catalogSource: source,
    _remoteThumb: remoteThumb,
    _remoteModal: remoteModal,
  };
}

async function downloadFile(url, dest, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = res.body;
      if (!body) throw new Error("empty body");
      await pipeline(Readable.fromWeb(body), createWriteStream(dest));
      return;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

async function runPool(tasks, concurrency) {
  let index = 0;
  const errors = [];

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        await tasks[i]();
      } catch (e) {
        errors.push(e);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return errors;
}

async function downloadAssets(catalog) {
  mkdirSync(THUMBS_DIR, { recursive: true });
  mkdirSync(MODALS_DIR, { recursive: true });

  const tasks = [];
  let skipped = 0;

  for (const entry of catalog) {
    const thumbDest = localThumbFile(entry.id);
    const modalDest = localModalFile(entry.id);

    if (entry._remoteThumb) {
      tasks.push(async () => {
        if (!FORCE_DOWNLOAD && existsSync(thumbDest)) {
          skipped++;
          return;
        }
        await downloadFile(entry._remoteThumb, thumbDest);
      });
    }

    if (entry._remoteModal) {
      tasks.push(async () => {
        if (!FORCE_DOWNLOAD && existsSync(modalDest)) {
          skipped++;
          return;
        }
        await downloadFile(entry._remoteModal, modalDest);
      });
    }
  }

  console.log(
    `Downloading up to ${tasks.length} images (concurrency ${CONCURRENCY})…`,
  );
  const errors = await runPool(tasks, CONCURRENCY);
  const downloaded = tasks.length - skipped - errors.length;

  if (errors.length) {
    console.warn(`Warning: ${errors.length} download(s) failed:`);
    for (const e of errors.slice(0, 8)) {
      console.warn(" ", e instanceof Error ? e.message : e);
    }
    if (errors.length > 8) console.warn(`  … and ${errors.length - 8} more`);
  }

  console.log(`Assets: ${downloaded} downloaded, ${skipped} skipped (already present)`);
}

const [general, business] = await Promise.all([
  fetchJson("zh/evaluation_data.json"),
  fetchJson("zh/business_prompts.json").catch(() => []),
]);

const merged = new Map();
for (const item of general) {
  const e = normalizeEntry(item, "evaluation_data");
  if (e) merged.set(e.id, e);
}
const bizList = Array.isArray(business) ? business : business.styles ?? business.items ?? [];
for (const item of bizList) {
  const e = normalizeEntry(item, "business_prompts");
  if (e) merged.set(e.id, e);
}

const catalogRaw = [...merged.values()].sort((a, b) => {
  const sa = a.score ?? 0;
  const sb = b.score ?? 0;
  if (sb !== sa) return sb - sa;
  return (a.number ?? 0) - (b.number ?? 0);
});

if (!SKIP_DOWNLOAD) {
  await downloadAssets(catalogRaw);
}

const styles = catalogRaw.map(({ _remoteThumb, _remoteModal, ...rest }) => rest);

const meta = {
  attributionUrl: `${REMOTE_BASE}zh/`,
  assetsLocalBase: "/image-styles/bananax/",
  remoteAssetBase: REMOTE_BASE,
  generatedAt: new Date().toISOString(),
  count: styles.length,
  note:
    "stylePromptZh 來自 BananaX 官網；預覽圖已鏡像至 apps/web/public/image-styles/bananax/。生圖時會加上 16:9、無可讀文字約束。",
};

mkdirSync(join(ROOT, "apps/web/public/data"), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify({ meta, styles }, null, 0), "utf8");
console.log(`Wrote ${styles.length} styles to ${OUT_JSON}`);

const sample = styles.find((s) => s.id === "nano_17");
if (sample) {
  console.log("nano_17:", sample.titleZh);
  console.log("  thumb:", sample.thumbnailUrl);
  console.log("  modal:", sample.previewUrl);
}
