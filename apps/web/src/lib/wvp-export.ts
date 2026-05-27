import type { SupabaseClient } from "@supabase/supabase-js";
import { hasBuiltPresentation } from "@/lib/wvp-workdir";
import { hasWvpDistInStorage } from "@/lib/wvp-dist-storage";

export function isV2Project(project: {
  edition?: string | null;
  presentation_revision?: string | null;
}): boolean {
  return project.edition === "v2" || !!project.presentation_revision;
}

/** 是否可走 WVP Playwright 匯出（本機 dist 或 Storage 皆有） */
export async function canExportWvpMp4(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  project: { edition?: string | null; presentation_revision?: string | null },
): Promise<boolean> {
  if (!isV2Project(project)) return false;
  if (await hasBuiltPresentation(projectId)) return true;
  return hasWvpDistInStorage(supabase, userId, projectId);
}
