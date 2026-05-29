import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectStepImageExtFromBuffer,
  normalizeStepImageExt,
  wvpStepImageFileName,
  type WvpStepImageExt,
} from "@courseflow/presentation";
import { presentationDirForProject } from "@/lib/wvp-workdir";

type CraftWithIllustrations = {
  wvp_chapter_id: string;
  checklist_result?: {
    narrations?: string[];
    stepIllustrations?: { stepIndex: number; imageExt?: string }[];
  } | null;
};

export function craftIllustrationStoragePath(
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
  ext: WvpStepImageExt = "jpg",
): string {
  return `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}/${wvpStepImageFileName(stepIndex, ext)}`;
}

function stepImageBaseName(stepIndex0: number): string {
  return String(stepIndex0 + 1).padStart(2, "0");
}

export function storageFileNameForStep(
  storageNames: Set<string>,
  stepIndex: number,
): string | null {
  const base = stepImageBaseName(stepIndex);
  for (const name of storageNames) {
    if (name.startsWith(`${base}.`)) return name;
  }
  return null;
}

export function extFromStorageFileName(fileName: string): WvpStepImageExt {
  const part = fileName.includes(".") ? (fileName.split(".").pop() ?? "jpg") : "jpg";
  return normalizeStepImageExt(part);
}

export async function findLocalStepIllustration(
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
): Promise<{ buffer: Buffer; ext: WvpStepImageExt } | null> {
  const dir = join(
    presentationDirForProject(projectId),
    "public",
    "images",
    wvpChapterId,
  );
  const base = stepImageBaseName(stepIndex);
  try {
    const names = await readdir(dir);
    for (const name of names) {
      if (!name.startsWith(`${base}.`)) continue;
      const buf = await readFile(join(dir, name));
      if (!buf.length) continue;
      const ext = extFromStorageFileName(name);
      return { buffer: buf, ext };
    }
  } catch {
    /* 目錄不存在 */
  }
  return null;
}

function readIllustrationsFromCraft(craft: CraftWithIllustrations): { stepIndex: number; imageExt?: string }[] {
  const raw = craft.checklist_result?.stepIllustrations;
  return Array.isArray(raw) ? (raw as { stepIndex: number; imageExt?: string }[]) : [];
}

/** 掃描本機 public/images/<章節>/ 已寫入的配圖檔 */
export async function resolveStepImageExtMapFromLocalDir(
  projectId: string,
  wvpChapterId: string,
): Promise<Record<number, WvpStepImageExt>> {
  const dir = join(
    presentationDirForProject(projectId),
    "public",
    "images",
    wvpChapterId,
  );
  const out: Record<number, WvpStepImageExt> = {};
  try {
    const names = await readdir(dir);
    for (const name of names) {
      const m = /^(\d{2})\.([a-z0-9]+)$/i.exec(name);
      if (!m) continue;
      const step = Number.parseInt(m[1]!, 10) - 1;
      if (step < 0) continue;
      out[step] = normalizeStepImageExt(m[2]!);
    }
  } catch {
    /* 無目錄 */
  }
  return out;
}

/** 僅 checklist + 本機 public/images（無 Storage API） */
export async function resolveStepImageExtMapLocal(
  projectId: string,
  craft: CraftWithIllustrations,
): Promise<Record<number, WvpStepImageExt>> {
  const out: Record<number, WvpStepImageExt> = {};
  const stored = readIllustrationsFromCraft(craft);
  const narrations = craft.checklist_result?.narrations;
  const narrLen = Array.isArray(narrations)
    ? narrations.length
    : stored.reduce((m, s) => Math.max(m, s.stepIndex + 1), 0);
  for (let step = 0; step < narrLen; step++) {
    const entry = stored.find((s) => s.stepIndex === step);
    if (entry?.imageExt) {
      out[step] = normalizeStepImageExt(entry.imageExt);
      continue;
    }
    const local = await findLocalStepIllustration(projectId, craft.wvp_chapter_id, step);
    if (local) out[step] = local.ext;
  }
  return out;
}

/** 打包／codegen 用：合併 checklist、本機檔與 Storage 檔名推斷各步副檔名 */
export async function resolveStepImageExtMap(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  craft: CraftWithIllustrations,
  storageNames?: Set<string>,
): Promise<Record<number, WvpStepImageExt>> {
  const out: Record<number, WvpStepImageExt> = {};
  const stored = readIllustrationsFromCraft(craft);
  const names =
    storageNames ??
    (await listStorageNamesForChapter(supabase, userId, projectId, craft.wvp_chapter_id));

  const narrations = craft.checklist_result?.narrations;
  const narrLen = Array.isArray(narrations)
    ? narrations.length
    : stored.reduce((m, s) => Math.max(m, s.stepIndex + 1), 0);

  for (let step = 0; step < narrLen; step++) {
    const entry = stored.find((s) => s.stepIndex === step);
    if (entry?.imageExt) {
      out[step] = normalizeStepImageExt(entry.imageExt);
      continue;
    }
    const storageFile = storageFileNameForStep(names, step);
    if (storageFile) {
      out[step] = extFromStorageFileName(storageFile);
      continue;
    }
    const local = await findLocalStepIllustration(projectId, craft.wvp_chapter_id, step);
    if (local) {
      out[step] = local.ext;
    }
  }
  return out;
}

async function listStorageNamesForChapter(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
): Promise<Set<string>> {
  const prefix = `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}`;
  const { data, error } = await supabase.storage.from("courseflow-assets").list(prefix);
  if (error || !data?.length) return new Set();
  return new Set(data.map((f) => f.name).filter(Boolean) as string[]);
}

export async function downloadStepIllustrationFromStorage(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
  ext: WvpStepImageExt = "jpg",
): Promise<Buffer | null> {
  const path = craftIllustrationStoragePath(userId, projectId, wvpChapterId, stepIndex, ext);
  const { data, error } = await supabase.storage.from("courseflow-assets").download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.length ? buf : null;
}

async function downloadStorageObject(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from("courseflow-assets")
    .download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.length ? buf : null;
}

export async function readStepIllustrationWithMeta(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  wvpChapterId: string,
  stepIndex: number,
  preferredExt?: WvpStepImageExt,
  storagePathHint?: string | null,
): Promise<{ buffer: Buffer; ext: WvpStepImageExt } | null> {
  if (storagePathHint?.trim()) {
    const hinted = await downloadStorageObject(supabase, storagePathHint.trim());
    if (hinted?.length) {
      const ext = extFromStorageFileName(storagePathHint.split("/").pop() ?? "01.jpg");
      return { buffer: hinted, ext: detectStepImageExtFromBuffer(hinted) || ext };
    }
  }

  const names = await listStorageNamesForChapter(supabase, userId, projectId, wvpChapterId);
  const listed = storageFileNameForStep(names, stepIndex);
  if (listed) {
    const prefix = `${userId}/${projectId}/wvp-illustrations/${wvpChapterId}/${listed}`;
    const listedBuf = await downloadStorageObject(supabase, prefix);
    if (listedBuf?.length) {
      return {
        buffer: listedBuf,
        ext: detectStepImageExtFromBuffer(listedBuf) || extFromStorageFileName(listed),
      };
    }
  }

  const tryExts: WvpStepImageExt[] = preferredExt
    ? [preferredExt, "jpg", "png", "gif", "jpeg", "bmp"]
    : ["jpg", "png", "gif", "jpeg", "bmp"];
  const seen = new Set<string>();
  for (const ext of tryExts) {
    if (seen.has(ext)) continue;
    seen.add(ext);
    const remote = await downloadStepIllustrationFromStorage(
      supabase,
      userId,
      projectId,
      wvpChapterId,
      stepIndex,
      ext,
    );
    if (remote?.length) {
      const detected = detectStepImageExtFromBuffer(remote);
      return { buffer: remote, ext: detected };
    }
  }

  const local = await findLocalStepIllustration(projectId, wvpChapterId, stepIndex);
  if (local) return local;
  return null;
}
