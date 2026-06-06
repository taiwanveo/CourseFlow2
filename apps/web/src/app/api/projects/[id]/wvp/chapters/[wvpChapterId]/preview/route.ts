import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { parseWvpSettings } from "@/lib/wvp-settings";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { buildSingleChapterPreview } from "@/lib/wvp-presentation-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 單章試跑預覽：僅打包指定章節供 wvp-play 預覽 */
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
    .select("wvp_phase_locks, phase_locks, wvp_settings, theme_id")
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

  const wvpSettings = parseWvpSettings(project.wvp_settings);
  const themeId = (wvpSettings.themeId ?? project.theme_id ?? "").trim();
  if (!themeId) {
    return NextResponse.json({ error: "請先選擇並儲存簡報主題" }, { status: 400 });
  }

  try {
    const build = await buildSingleChapterPreview(supabase, id, user.id, wvpChapterId, {
      themeId,
    });
    const previewUrl = `/projects/${id}/wvp-play?chapterPreview=1`;
    return NextResponse.json({
      ok: true,
      wvpChapterId: build.wvpChapterId,
      chapterTitle: build.chapterTitle,
      previewUrl,
      illustrationSyncWarning: build.illustrationSyncWarning,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
