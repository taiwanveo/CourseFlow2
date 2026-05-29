import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import type { LlmProviderId } from "@courseflow/llm";
import { resolveLlmProvider, resolveEffectiveTextModel } from "@/lib/llm-provider";
import { runAnchorChapterTrial } from "@/lib/wvp-chapter-craft";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { parseWvpSettings } from "@/lib/wvp-settings";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 試執行第 1 章：匯入口播、套用模板、AI 產生、打包僅第 1 章預覽 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const styleGuard = assertProjectImageStyleConfigured(project.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: LlmProviderId };
  const resolved = await resolveLlmProvider(supabase, user.id, body.provider);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  try {
    const result = await runAnchorChapterTrial(supabase, id, user.id, {
      provider: resolved.provider,
      encryptedKey: resolved.encryptedKey,
      textModel: resolveEffectiveTextModel(resolved.provider, resolved.textModel, resolved.defaultModel),
      themeId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "試執行失敗" }, { status: 400 });
    }
    return NextResponse.json({
      ...result,
      anchorChapterTrialCompleted: true,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
