import type { CourseComposition } from "@courseflow/core";
import {
  createEmptyComposition,
  defaultChapterVisualForStep,
  ensureChapterDividerSteps,
} from "@courseflow/core";
import type { createClient } from "@/lib/supabase/server";
import { defaultSubtitleForStep, defaultVisualForStep } from "@courseflow/db";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadProjectComposition(
  supabase: Supabase,
  projectId: string,
  opts?: { forceFresh?: boolean },
): Promise<CourseComposition | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project) return null;

  const snap = project.composition_snapshot as CourseComposition | null;
  if (!opts?.forceFresh && snap?.steps?.length) {
    if (!snap.meta.themeId && project.theme_id) {
      snap.meta.themeId = project.theme_id;
    }
    return ensureChapterDividerSteps(snap);
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  const chapterIds = (chapters ?? []).map((c: { id: string }) => c.id);
  const { data: steps } = chapterIds.length
    ? await supabase.from("steps").select("*").in("chapter_id", chapterIds).order("sort_order")
    : { data: [] };

  const composition = createEmptyComposition(
    (project.settings as { language?: string })?.language ?? "zh-TW",
  );
  composition.meta.themeId = project.theme_id;
  composition.chapters = (chapters ?? []).map((c: { id: string; parent_id: string | null; title: string; sort_order: number }) => ({
    id: c.id,
    parentId: c.parent_id,
    title: c.title,
    sortOrder: c.sort_order,
  }));
  composition.steps = (steps ?? []).map(
    (s: {
      id: string;
      chapter_id: string;
      sort_order: number;
      script: string;
      screen_summary: string;
      info_pool: unknown;
      step_kind?: string;
    }) => ({
      id: s.id,
      chapterId: s.chapter_id,
      sortOrder: s.sort_order,
      stepKind: s.step_kind === "chapter" ? "chapter" : "content",
      script: s.script,
      screenContent: s.screen_summary,
      infoPool: (s.info_pool as string[]) ?? [],
    }),
  );

  for (const step of composition.steps) {
    if (!composition.subtitles.find((x) => x.stepId === step.id)) {
      composition.subtitles.push(defaultSubtitleForStep(step.id));
    }
    if (!composition.visuals.find((x) => x.stepId === step.id)) {
      composition.visuals.push(
        step.stepKind === "chapter"
          ? defaultChapterVisualForStep(step.id, step.screenContent)
          : defaultVisualForStep(step.id, step.screenContent),
      );
    }
  }

  return ensureChapterDividerSteps(composition);
}

/**
 * WVP 打包／試執行：步驟結構以 DB 為準，文稿螢幕欄位以 composition_snapshot 為準。
 * 使用者在「文稿內容」的修改寫入 snapshot；若 steps 表 screen_summary 未同步，
 * 僅 forceFresh 會讀到空白螢幕欄位而退回口播稿文字。
 */
export async function loadCompositionForWvpBuild(
  supabase: Supabase,
  projectId: string,
): Promise<CourseComposition | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("composition_snapshot, theme_id, settings")
    .eq("id", projectId)
    .single();
  if (!project) return null;

  const snap = project.composition_snapshot as CourseComposition | null;
  if (snap?.steps?.length) {
    const language =
      snap.meta?.language ??
      (project.settings as { language?: string } | null)?.language ??
      "zh-TW";
    const composition = ensureChapterDividerSteps({
      ...snap,
      meta: {
        ...snap.meta,
        language,
        themeId: snap.meta.themeId ?? project.theme_id ?? undefined,
      },
    });
    return composition;
  }

  return loadProjectComposition(supabase, projectId, { forceFresh: true });
}

export async function saveComposition(
  supabase: Supabase,
  projectId: string,
  composition: CourseComposition,
): Promise<void> {
  await supabase
    .from("projects")
    .update({ composition_snapshot: composition as unknown as Record<string, unknown> })
    .eq("id", projectId);
}
