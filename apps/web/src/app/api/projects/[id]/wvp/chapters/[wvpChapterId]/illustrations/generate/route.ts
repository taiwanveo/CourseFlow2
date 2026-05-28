import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { generateChapterIllustrationSteps } from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";
export const maxDuration = 300;

function readSteps(craft: { checklist_result?: unknown }) {
  const cr = craft.checklist_result as { stepIllustrations?: { stepIndex: number; status: string; confirmedAt?: string | null; promptForApi?: string }[] } | null;
  return cr?.stepIllustrations ?? [];
}

/** 依已確認提示詞生圖（單步或本章全部已確認步驟） */
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
    .select("wvp_settings, wvp_phase_locks, phase_locks")
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

  const body = (await req.json().catch(() => ({}))) as {
    stepIndex?: number;
    allConfirmed?: boolean;
  };

  const stored = readSteps(craft);
  let indices: number[] = [];
  if (typeof body.stepIndex === "number") {
    indices = [body.stepIndex];
  } else if (body.allConfirmed) {
    indices = stored
      .filter(
        (s) =>
          s.status !== "skip" &&
          s.promptForApi?.trim() &&
          (s.confirmedAt || s.status === "prompt-ready" || s.status === "done"),
      )
      .map((s) => s.stepIndex);
  } else {
    return NextResponse.json({ error: "請指定 stepIndex 或 allConfirmed" }, { status: 400 });
  }

  if (indices.length === 0) {
    return NextResponse.json({ error: "沒有可生圖的步驟（請先確認提示詞）" }, { status: 400 });
  }

  const styleFragment = resolveImageStyleFragment(styleGuard.settings.imageStyle);

  try {
    const { steps, generated } = await generateChapterIllustrationSteps(
      supabase,
      user.id,
      id,
      craft,
      indices,
      { styleFragment, imageStyleId: styleGuard.imageStyle.id },
    );
    return NextResponse.json({
      ok: true,
      wvpChapterId,
      steps,
      generated,
      requested: indices.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
