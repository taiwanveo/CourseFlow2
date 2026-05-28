import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downloadDistDirectory,
  readDistManifest,
  uploadDistDirectory,
  wvpDistStoragePrefix,
} from "@courseflow/presentation";
import { access, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasBuiltPresentation, presentationDistDir } from "@/lib/wvp-workdir";

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

/** Render /tmp 等易失目錄：本機無 dist 時從 Storage 還原後再預覽 */
export async function ensureWvpDistLocal(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  if (await hasBuiltPresentation(projectId)) return true;
  if (!(await hasWvpDistInStorage(supabase, userId, projectId))) return false;
  const dest = presentationDistDir(projectId);
  await mkdir(dest, { recursive: true });
  await downloadWvpDistFromStorage(supabase, userId, projectId, dest);
  try {
    await access(join(dest, "index.html"));
    return true;
  } catch {
    return false;
  }
}
