/**
 * WVP dist 的 Storage 同步層。
 *
 * CourseFlow 的 WVP 預覽不是只存在記憶體中的暫時產物，而是一組實際的靜態檔案。
 * 這些檔案可能在以下情境被重用：
 * 1. 本機 build 完後，提供前端預覽。
 * 2. Web / Worker 在不同容器、不同機器時，從 Storage 取回已 build 的 dist。
 * 3. 背景 MP4 匯出時，不重新 build，而是直接還原既有 dist。
 *
 * 因此這個模組的責任是「dist 的持久化與還原」，而不是 build 本身。
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

/**
 * 將本機 `presentation/dist` 連同 manifest 一起上傳到 Storage。
 *
 * manifest 的用途是穩定列舉 dist 內所有檔案，讓之後的下載不必依賴 Storage list 的最終一致性或額外列目錄邏輯。
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
      const { error } = await supabase.storage.from("courseflow-assets").upload(path, body, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(error.message);
    },
    prefix,
    distDir,
  );

  await supabase.storage.from("courseflow-assets").upload(
    `${prefix}/cf-dist-manifest.json`,
    Buffer.from(JSON.stringify(manifest)),
    { contentType: "application/json", upsert: true },
  );

  return { fileCount: count, storagePrefix: prefix };
}

/**
 * 從 Storage 還原某個專案先前已上傳的 WVP dist。
 *
 * 若 manifest 存在，會優先使用 manifest 還原完整檔案集；若 manifest 不存在，則退回 helper 的容錯流程。
 */
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
      .from("courseflow-assets")
      .download(`${prefix}/cf-dist-manifest.json`);
    if (data) {
      manifest = JSON.parse(await data.text()) as string[];
    }
  } catch {
    manifest = undefined;
  }

  await downloadDistDirectory(
    async (path) => {
      const { data, error } = await supabase.storage.from("courseflow-assets").download(path);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    prefix,
    destDir,
    manifest,
  );
}

/**
 * 快速檢查 Storage 中是否已經有可用的 dist。
 *
 * 這裡用 `index.html` 當存在性探針，因為只要少了它，整份 dist 就不可能被正常預覽或錄製。
 */
export async function hasWvpDistInStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const prefix = wvpDistStoragePrefix(userId, projectId);
  const { data, error } = await supabase.storage
    .from("courseflow-assets")
    .download(`${prefix}/index.html`);
  return !error && !!data;
}

/**
 * 確保本機工作目錄中存在可用的 dist。
 *
 * 典型情境是 Render / Worker 容器的本地磁碟屬於易失空間：
 * 即使先前 build 過，換了一個新容器之後本地檔案仍可能消失。
 * 這時若 Storage 有快取，就先還原到本地，再讓後續流程以「本機已有 dist」的方式繼續執行。
 */
function distRevisionMarkerPath(projectId: string): string {
  return join(presentationDistDir(projectId), ".cf-presentation-revision");
}

export async function ensureWvpDistLocal(
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
  let cachedRevision: string | null = null;
  try {
    cachedRevision = (await readFile(markerPath, "utf8")).trim() || null;
  } catch {
    cachedRevision = null;
  }

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
