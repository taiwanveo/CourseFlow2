import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveImageStyleFragment } from "@/lib/image-style.server";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { planChapterIllustrationPrompts } from "@/lib/wvp-craft-illustrations";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Visual Director：產出各步真實生圖提示詞（不生成圖片） */
export async function POST(
  _req: NextRequest,
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
    .select("title, theme_id, wvp_settings, wvp_phase_locks, phase_locks")
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

  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }

  const wvpSettings = styleGuard.settings;
  const themeId = wvpSettings.themeId ?? project.theme_id ?? "midnight-press";
  const styleFragment = resolveImageStyleFragment(wvpSettings.imageStyle);

  try {
    const state = await planChapterIllustrationPrompts(
      supabase,
      user.id,
      id,
      project.title ?? "Course",
      craft,
      composition,
      themeId,
      styleFragment,
    );
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
