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
import { shouldAsyncWvpCraftJobs } from "@/lib/wvp-craft-async";
import { runWvpTrialChapter1 } from "@/lib/run-wvp-trial-chapter-1";

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

  if (shouldAsyncWvpCraftJobs()) {
    const { data: existingJob } = await supabase
      .from("job_runs")
      .select("id")
      .eq("project_id", id)
      .eq("job_type", "wvp-trial-chapter-1")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob?.id) {
      return NextResponse.json(
        {
          ok: true,
          queued: true,
          jobRunId: existingJob.id,
          message: "已有第 1 章試執行任務進行中，請稍候…",
        },
        { status: 202 },
      );
    }

    const { data: jobRun, error: jobError } = await supabase
      .from("job_runs")
      .insert({
        project_id: id,
        user_id: user.id,
        job_type: "wvp-trial-chapter-1",
        status: "pending",
        payload: {
          provider: resolved.provider,
          themeId,
        },
      })
      .select("id")
      .single();

    if (jobError || !jobRun) {
      return NextResponse.json(
        { error: jobError?.message ?? "無法建立試執行任務" },
        { status: 500 },
      );
    }

    setImmediate(() => {
      void runWvpTrialChapter1({
        projectId: id,
        userId: user.id,
        jobRunId: jobRun.id,
        provider: resolved.provider,
        themeId,
      }).catch((err) => {
        console.error("[wvp-trial-job] 背景試執行失敗:", err);
      });
    });

    return NextResponse.json(
      {
        ok: true,
        queued: true,
        jobRunId: jobRun.id,
        message: "第 1 章試執行已開始，請稍候…",
      },
      { status: 202 },
    );
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
