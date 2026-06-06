import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import type { StepIllustrationEntry } from "@/lib/wvp-craft-illustrations";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import {
  generateChapterIllustrationImageEntry,
  generateChapterIllustrationSteps,
} from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";
export const maxDuration = 300;

function stepIndicesForBatch(craft: { checklist_result?: unknown }): number[] {
  const cr = craft.checklist_result as { stepIllustrations?: StepIllustrationEntry[] } | null;
  return (cr?.stepIllustrations ?? [])
    .filter(
      (s) =>
        s.needsImage !== false &&
        (s.imageSource ?? "ai") === "ai" &&
        s.batchSelected !== false &&
        s.promptForApi.trim(),
    )
    .map((s) => s.stepIndex);
}

/** 整章生一張圖，或依 stepIndex / allConfirmed 逐步生圖 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("theme_id, wvp_settings, wvp_phase_locks, phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const styleGuard = assertProjectImageStyleConfigured(project.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .single();
  if (!craft) return NextResponse.json({ error: "章節不存在" }, { status: 404 });

  const themeId = styleGuard.settings.themeId ?? project.theme_id ?? "midnight-press";
  const styleFragment = await resolveImageStyleFragment(styleGuard.settings.imageStyle, themeId);
  const imageStyleId =
    styleGuard.imageStyleId === "theme-default"
      ? `theme-default:${themeId}`
      : styleGuard.imageStyleId;
  const genOpts = { styleFragment, imageStyleId };

  const body = (await req.json().catch(() => ({}))) as {
    stepIndex?: number;
    allConfirmed?: boolean;
  };

  try {
    if (typeof body.stepIndex === "number") {
      const result = await generateChapterIllustrationSteps(
        supabase,
        user.id,
        id,
        craft,
        [body.stepIndex],
        genOpts,
      );
      return NextResponse.json({
        ok: true,
        wvpChapterId,
        steps: result.steps,
        generated: result.generated,
      });
    }

    if (body.allConfirmed) {
      const indices = stepIndicesForBatch(craft);
      const result = await generateChapterIllustrationSteps(
        supabase,
        user.id,
        id,
        craft,
        indices,
        genOpts,
      );
      return NextResponse.json({
        ok: true,
        wvpChapterId,
        steps: result.steps,
        generated: result.generated,
      });
    }

    const entry = await generateChapterIllustrationImageEntry(
      supabase,
      user.id,
      id,
      craft,
      genOpts,
    );
    return NextResponse.json({ ok: true, wvpChapterId, chapterIllustration: entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
