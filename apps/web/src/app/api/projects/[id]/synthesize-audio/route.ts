import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import type { TtsProviderId } from "@courseflow/tts";
import { runSynthesizeAudio } from "@/lib/run-synthesize-audio";
import {
  createInitialTtsBatchProgress,
  stepLabelFromScript,
} from "@/lib/tts-batch-progress";
import { loadProjectComposition } from "@/lib/project-composition";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    .select("phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "audio");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json()) as {
    provider: string;
    voiceId: string;
    model?: string;
    stepIds?: string[];
  };

  if (!body.voiceId?.trim()) {
    return NextResponse.json({ error: "請選擇語音" }, { status: 400 });
  }

  if (body.provider === "openrouter" && !body.model?.trim()) {
    return NextResponse.json({ error: "請選擇 OpenRouter TTS 模型" }, { status: 400 });
  }

  const jobPayload = {
    projectId: id,
    userId: user.id,
    provider: body.provider as TtsProviderId,
    voiceId: body.voiceId,
    model: body.model,
    stepIds: body.stepIds,
  };

  const isBatch = !body.stepIds?.length;
  const composition = isBatch ? await loadProjectComposition(supabase, id) : null;
  const targetSteps = composition?.steps
    ? body.stepIds?.length
      ? composition.steps.filter((step) => body.stepIds!.includes(step.id))
      : composition.steps
    : [];

  const initialProgress =
    isBatch && targetSteps.length > 0
      ? createInitialTtsBatchProgress(
          targetSteps.map((step, index) => ({
            stepId: step.id,
            label: stepLabelFromScript(step.script, step.sortOrder ?? index),
            sortOrder: step.sortOrder ?? index,
            hasScript: Boolean(step.script.trim()),
          })),
        )
      : undefined;

  const initialResult = initialProgress
    ? {
        ok: false,
        progress: initialProgress,
        summary: {
          total: initialProgress.totalSteps,
          done: 0,
          failed: 0,
          skipped: initialProgress.steps.filter((s) => s.status === "skipped").length,
        },
      }
    : undefined;

  console.log(
    `[tts-batch] create job project=${id} user=${user.id} batch=${isBatch} steps=${initialProgress?.totalSteps ?? body.stepIds?.length ?? 0}`,
  );

  const { data: jobRun, error: jobError } = await supabase
    .from("job_runs")
    .insert({
      project_id: id,
      user_id: user.id,
      job_type: "synthesize-audio",
      status: "pending",
      result: initialResult,
      payload: body,
    })
    .select()
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  const { shouldUseJobQueue } = await import("@/lib/job-queue");

  let queued = false;
  if (await shouldUseJobQueue()) {
    try {
      const { getAudioQueue } = await import("@/lib/queue");
      await getAudioQueue().add("synthesize", {
        ...jobPayload,
        jobRunId: jobRun.id,
      });
      queued = true;
    } catch {
      const { resetQueueConnection } = await import("@/lib/queue");
      await resetQueueConnection();
      queued = false;
    }
  }

  if (!queued && isBatch) {
    console.log(`[tts-batch] Web inline job=${jobRun.id} project=${id}`);
    setImmediate(() => {
      void runSynthesizeAudio({ ...jobPayload, jobRunId: jobRun.id }).catch(async (err) => {
        const message = err instanceof Error ? err.message : "語音合成失敗";
        console.error(`[tts-batch] Web inline failed job=${jobRun.id}:`, message);
        await supabase
          .from("job_runs")
          .update({
            status: "failed",
            error_message: message.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRun.id);
      });
    });
    return NextResponse.json({
      ok: true,
      jobRunId: jobRun.id,
      inline: false,
      message: "批次語音合成已開始，請稍候…",
    });
  }

  if (!queued) {
    const internalSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    if (!internalSecret) {
      await supabase
        .from("job_runs")
        .update({ status: "failed", error_message: "缺少 API_KEY_ENCRYPTION_SECRET" })
        .eq("id", jobRun.id);
      return NextResponse.json({ error: "伺服器設定不完整，無法進行語音合成" }, { status: 500 });
    }

    try {
      await runSynthesizeAudio({ ...jobPayload, jobRunId: jobRun.id });
      return NextResponse.json({ ok: true, jobRunId: jobRun.id, inline: true });
    } catch (e) {
      await supabase
        .from("job_runs")
        .update({ status: "failed", error_message: (e as Error).message })
        .eq("id", jobRun.id);
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  console.log(`[tts-batch] enqueued job=${jobRun.id} project=${id}`);
  return NextResponse.json({
    ok: true,
    jobRunId: jobRun.id,
    inline: false,
    message: "批次語音合成已加入佇列，請稍候…",
  });
}
