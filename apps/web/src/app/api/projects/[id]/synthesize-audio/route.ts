import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertPhaseEditable } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import type { TtsProviderId } from "@courseflow/tts";
import { runSynthesizeAudio } from "@/lib/run-synthesize-audio";

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

  const jobPayload = {
    projectId: id,
    userId: user.id,
    provider: body.provider as TtsProviderId,
    voiceId: body.voiceId,
    model: body.model,
    stepIds: body.stepIds,
  };

  const { data: jobRun, error: jobError } = await supabase
    .from("job_runs")
    .insert({
      project_id: id,
      user_id: user.id,
      job_type: "synthesize-audio",
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
      await runSynthesizeAudio(jobPayload);
      await supabase.from("job_runs").update({ status: "completed" }).eq("id", jobRun.id);
      return NextResponse.json({ ok: true, jobRunId: jobRun.id, inline: true });
    } catch (e) {
      await supabase
        .from("job_runs")
        .update({ status: "failed", error_message: (e as Error).message })
        .eq("id", jobRun.id);
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, jobRunId: jobRun.id, inline: false });
}
