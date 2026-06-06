/**
 * WVP dist 的 Storage 同步層。
 *
 * CourseFlow 的 WVP 預覽不是只存在記憶體中的暫時產物，而是一組實際的靜態檔案。
 * 這些檔案可能在以下情境被重用：
 * 1. 本機 build 完後，提供前端預覽。
 * 2. Web / Worker 在不同容器、不同機器時，從 Storage 取回已 build 的 dist。
 * 3. 背景 MP4 匯出時，不重新 build，而是直接還原既有 dist。
 *
 * 預覽播放優化：靜態資源可走 Storage 簽名 URL（CDN），避免每個檔案都經 Next 代理讀碟。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downloadDistDirectory,
  readDistManifest,
  uploadDistDirectory,
  wvpDistStoragePrefix,
} from "@courseflow/presentation";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasBuiltPresentation, presentationDistDir } from "@/lib/wvp-workdir";

export const WVP_DIST_BUCKET = "courseflow-assets";

const DIST_READY_CACHE_MS = 120_000;
const SIGNED_URL_EXPIRES_SEC = 3600;
const SIGNED_URL_CACHE_MS = (SIGNED_URL_EXPIRES_SEC - 300) * 1000;

function distEnsureCacheKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

function distSignedUrlCacheKey(userId: string, projectId: string, relPath: string): string {
  return `${userId}:${projectId}:${relPath}`;
}

/** 程序內快取：避免 iframe 並行載入 30+ 資源時重複查 DB／重複從 Storage 還原 */
const distReadyCache = new Map<string, { revision: string | null; until: number }>();
const distEnsureInFlight = new Map<string, Promise<boolean>>();
const distSignedUrlCache = new Map<string, { url: string; until: number }>();

export function wvpDistObjectPath(userId: string, projectId: string, relPath: string): string {
  const rel = relPath.replace(/^\/+/, "") || "index.html";
  return `${wvpDistStoragePrefix(userId, projectId)}/${rel}`;
}

/** 預設開啟；設 COURSEFLOW_WVP_STORAGE_REDIRECT=0 可關閉（改回 Next 代理） */
export function shouldServeWvpAssetsViaStorage(): boolean {
  return process.env.COURSEFLOW_WVP_STORAGE_REDIRECT?.trim() !== "0";
}

function distRevisionMarkerPath(projectId: string): string {
  return join(presentationDistDir(projectId), ".cf-presentation-revision");
}

async function readLocalDistRevision(projectId: string): Promise<string | null> {
  try {
    return (await readFile(distRevisionMarkerPath(projectId), "utf8")).trim() || null;
  } catch {
    return null;
  }
}

/** 新建置開始前呼叫，避免短時間內仍命中舊 dist 快取 */
export function invalidateWvpDistLocalCache(userId: string, projectId: string): void {
  distReadyCache.delete(distEnsureCacheKey(userId, projectId));
}

export function invalidateWvpDistCaches(userId: string, projectId: string): void {
  invalidateWvpDistLocalCache(userId, projectId);
  const prefix = `${userId}:${projectId}:`;
  for (const key of distSignedUrlCache.keys()) {
    if (key.startsWith(prefix)) distSignedUrlCache.delete(key);
  }
}

/**
 * 是否可進入預覽播放（本機 dist 或 Storage 有 index 即可，不必先還原整包）。
 */
export async function isWvpDistPlayable(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  if (await hasBuiltPresentation(projectId)) return true;
  return hasWvpDistInStorage(supabase, userId, projectId);
}

/**
 * 為 dist 內單一檔案建立 Storage 簽名 URL（供 wvp-embed 307 轉址至 CDN）。
 */
export async function createWvpDistSignedUrl(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  relPath: string,
): Promise<string | null> {
  const rel = relPath.replace(/^\/+/, "") || "index.html";
  const cacheKey = distSignedUrlCacheKey(userId, projectId, rel);
  const cached = distSignedUrlCache.get(cacheKey);
  if (cached && Date.now() < cached.until) {
    return cached.url;
  }

  const storagePath = wvpDistObjectPath(userId, projectId, rel);
  const { data, error } = await supabase.storage
    .from(WVP_DIST_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error || !data?.signedUrl) {
    return null;
  }

  distSignedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    until: Date.now() + SIGNED_URL_CACHE_MS,
  });
  return data.signedUrl;
}

/** 僅拉 index.html（保留 wvp-embed URL 上的 query 參數給 SPA） */
export async function readWvpDistIndexFromStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<Buffer | null> {
  const storagePath = wvpDistObjectPath(userId, projectId, "index.html");
  const { data, error } = await supabase.storage.from(WVP_DIST_BUCKET).download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * 將本機 `presentation/dist` 連同 manifest 一起上傳到 Storage。
 */
export async function uploadWvpDistToStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<{ fileCount: number; storagePrefix: string }> {
  const distDir = presentationDistDir(projectId);
  const manifest = await readDistManifest(distDir);
  const prefix = wvpDistStoragePrefix(userId, projectId);

  const count = await uploadDistDirectory(
    async (path, body, contentType) => {
      const { error } = await supabase.storage.from(WVP_DIST_BUCKET).upload(path, body, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(error.message);
    },
    prefix,
    distDir,
  );

  await supabase.storage.from(WVP_DIST_BUCKET).upload(
    `${prefix}/cf-dist-manifest.json`,
    Buffer.from(JSON.stringify(manifest)),
    { contentType: "application/json", upsert: true },
  );

  invalidateWvpDistCaches(userId, projectId);

  return { fileCount: count, storagePrefix: prefix };
}

export async function downloadWvpDistFromStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  destDir: string,
): Promise<void> {
  const prefix = wvpDistStoragePrefix(userId, projectId);
  await mkdir(destDir, { recursive: true });

  let manifest: string[] | undefined;
  try {
    const { data } = await supabase.storage
      .from(WVP_DIST_BUCKET)
      .download(`${prefix}/cf-dist-manifest.json`);
    if (data) {
      manifest = JSON.parse(await data.text()) as string[];
    }
  } catch {
    manifest = undefined;
  }

  await downloadDistDirectory(
    async (path) => {
      const { data, error } = await supabase.storage.from(WVP_DIST_BUCKET).download(path);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    prefix,
    destDir,
    manifest,
  );
}

export async function hasWvpDistInStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const storagePath = wvpDistObjectPath(userId, projectId, "index.html");
  const { data, error } = await supabase.storage.from(WVP_DIST_BUCKET).download(storagePath);
  return !error && !!data;
}

async function ensureWvpDistLocalOnce(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data: project } = await supabase
    .from("projects")
    .select("presentation_revision")
    .eq("id", projectId)
    .maybeSingle();
  const revision =
    typeof project?.presentation_revision === "string"
      ? project.presentation_revision
      : null;

  const dest = presentationDistDir(projectId);
  const markerPath = distRevisionMarkerPath(projectId);
  const cachedRevision = await readLocalDistRevision(projectId);

  const localMatchesRevision =
    revision !== null &&
    cachedRevision === revision &&
    (await hasBuiltPresentation(projectId));
  if (localMatchesRevision) return true;

  if (!(await hasWvpDistInStorage(supabase, userId, projectId))) {
    return false;
  }

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await downloadWvpDistFromStorage(supabase, userId, projectId, dest);
  if (revision) {
    await writeFile(markerPath, revision, "utf8");
  }
  try {
    await access(join(dest, "index.html"));
    return true;
  } catch {
    return false;
  }
}

/**
 * 確保本機工作目錄中存在可用的 dist（Worker 錄製等仍需完整本機副本）。
 */
export async function ensureWvpDistLocal(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const cacheKey = distEnsureCacheKey(userId, projectId);
  const cached = distReadyCache.get(cacheKey);
  if (cached && Date.now() < cached.until) {
    const marker = await readLocalDistRevision(projectId);
    if (marker === cached.revision && (await hasBuiltPresentation(projectId))) {
      return true;
    }
  }

  let flight = distEnsureInFlight.get(cacheKey);
  if (!flight) {
    flight = ensureWvpDistLocalOnce(supabase, userId, projectId).finally(() => {
      distEnsureInFlight.delete(cacheKey);
    });
    distEnsureInFlight.set(cacheKey, flight);
  }

  const ok = await flight;
  if (ok) {
    distReadyCache.set(cacheKey, {
      revision: await readLocalDistRevision(projectId),
      until: Date.now() + DIST_READY_CACHE_MS,
    });
  } else {
    distReadyCache.delete(cacheKey);
  }
  return ok;
}
