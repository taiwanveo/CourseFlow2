import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import {
  chapterHasStepExplainAnimations,
  getChapterIllustrationEntryState,
  getChapterIllustrationsState,
  patchChapterIllustrationEntry,
  patchChapterIllustrationPrompts,
} from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";

async function loadCraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
  wvpChapterId: string,
) {
  const { data: project } = await supabase
    .from("projects")
    .select("wvp_phase_locks, phase_locks")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (!project) return { error: NextResponse.json({ error: "找不到專案" }, { status: 404 }) };

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return { error: NextResponse.json({ error: (e as Error).message }, { status: 403 }) };
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", projectId)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return { error: NextResponse.json({ error: "章節不存在" }, { status: 404 }) };

  return { craft, project };
}

/** 取得本章配圖狀態（整章 + 逐步） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const loaded = await loadCraft(supabase, id, user.id, wvpChapterId);
  if ("error" in loaded && loaded.error) return loaded.error;

  const composition = await loadProjectComposition(supabase, id);
  const chapterIllustration = await getChapterIllustrationEntryState(
    supabase,
    user.id,
    id,
    loaded.craft!,
  );

  const stepState = composition
    ? await getChapterIllustrationsState(supabase, user.id, id, loaded.craft!, composition)
    : {
        wvpChapterId,
        templateKind: undefined,
        steps: [],
        updatedAt: undefined,
      };

  return NextResponse.json({
    ok: true,
    chapterIllustration,
    stepAnimationActive: chapterHasStepExplainAnimations(loaded.craft!),
    ...stepState,
  });
}

/** 更新配圖：body.patches → 逐步；否則 → 整章 ChapterIllustrationEntry */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const loaded = await loadCraft(supabase, id, user.id, wvpChapterId);
  if ("error" in loaded && loaded.error) return loaded.error;

  const body = (await req.json()) as {
    patches?: Array<{
      stepIndex: number;
      promptForApi?: string;
      confirm?: boolean;
      needsImage?: boolean;
      imageSource?: "ai" | "upload" | "animation";
      batchSelected?: boolean;
      animationHtml?: string | null;
    }>;
    visualMode?: "animation" | "ai-image" | "upload";
    promptForApi?: string;
    confirm?: boolean;
  };

  if (body.patches?.length) {
    await patchChapterIllustrationPrompts(
      supabase,
      user.id,
      id,
      loaded.craft!,
      body.patches,
    );
    const { data: updatedCraft } = await supabase
      .from("chapter_craft")
      .select("*")
      .eq("project_id", id)
      .eq("wvp_chapter_id", wvpChapterId)
      .single();
    const composition = await loadProjectComposition(supabase, id);
    const stepState =
      composition && updatedCraft
        ? await getChapterIllustrationsState(supabase, user.id, id, updatedCraft, composition)
        : {
            wvpChapterId,
            templateKind: undefined,
            steps: [],
            updatedAt: undefined,
          };
    const chapterIllustration = updatedCraft
      ? await getChapterIllustrationEntryState(supabase, user.id, id, updatedCraft)
      : undefined;
    return NextResponse.json({
      ok: true,
      chapterIllustration,
      stepAnimationActive: updatedCraft
        ? chapterHasStepExplainAnimations(updatedCraft)
        : false,
      ...stepState,
    });
  }

  if (
    (body.visualMode === "ai-image" || body.visualMode === "upload") &&
    chapterHasStepExplainAnimations(loaded.craft!)
  ) {
    return NextResponse.json(
      { error: "本章已有步驟解說動畫，無法使用整章 AI 生圖或上傳圖片" },
      { status: 409 },
    );
  }

  const entry = await patchChapterIllustrationEntry(supabase, id, loaded.craft!, {
    ...(body.visualMode !== undefined ? { visualMode: body.visualMode } : {}),
    ...(body.promptForApi !== undefined ? { promptForApi: body.promptForApi } : {}),
    ...(body.confirm !== undefined
      ? ({ confirm: body.confirm } as Record<string, unknown>)
      : {}),
  });
  return NextResponse.json({
    ok: true,
    wvpChapterId,
    chapterIllustration: entry,
    stepAnimationActive: chapterHasStepExplainAnimations(loaded.craft!),
  });
}
