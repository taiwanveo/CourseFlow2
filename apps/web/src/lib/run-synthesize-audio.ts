import type { CourseComposition } from "@courseflow/core";
import type { TtsProviderId } from "@courseflow/tts";
import { synthesizeSpeech } from "@courseflow/tts";
import { decryptApiKey } from "@/lib/crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { saveComposition } from "@/lib/project-composition";
import {
  createInitialTtsBatchProgress,
  stepLabelFromScript,
  type TtsBatchProgress,
  type TtsSynthesizeJobResult,
} from "@/lib/tts-batch-progress";
import { narrationTextForStep } from "@/lib/wvp-step-text";

const STEP_SYNTHESIS_TIMEOUT_MS = 180_000;
const STEP_PROGRESS_HEARTBEAT_MS = 5_000;

function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 逾時（>${Math.round(timeoutMs / 1000)} 秒），請稍後重試`));
    }, timeoutMs);
    work
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function synthesizeStepAudio(
  provider: TtsProviderId,
  text: string,
  voiceId: string,
  apiKey?: string,
  model?: string,
): Promise<Buffer> {
  return withTimeout(
    synthesizeSpeech(
      provider,
      text,
      voiceId,
      apiKey ? { provider, apiKey } : { provider },
      model ? { model } : undefined,
    ),
    STEP_SYNTHESIS_TIMEOUT_MS,
    "單步語音合成",
  );
}

function updateStepProgress(
  progress: TtsBatchProgress,
  stepId: string,
  patch: Partial<TtsBatchProgress["steps"][number]>,
): void {
  const idx = progress.steps.findIndex((s) => s.stepId === stepId);
  if (idx >= 0) {
    progress.steps[idx] = { ...progress.steps[idx]!, ...patch };
  }
}

function buildJobResult(progress: TtsBatchProgress): TtsSynthesizeJobResult {
  const failed = progress.steps.filter((s) => s.status === "failed").length;
  return {
    ok: failed === 0,
    progress: { ...progress, steps: [...progress.steps] },
    summary: {
      total: progress.totalSteps,
      done: progress.steps.filter((s) => s.status === "done").length,
      failed,
      skipped: progress.steps.filter((s) => s.status === "skipped").length,
    },
  };
}

export async function runSynthesizeAudio(payload: {
  projectId: string;
  userId: string;
  provider: TtsProviderId;
  voiceId: string;
  model?: string;
  stepIds?: string[];
  jobRunId?: string;
}): Promise<TtsSynthesizeJobResult> {
  const supabase = createServiceClient();

  const patchJob = async (patch: {
    status: string;
    result?: TtsSynthesizeJobResult;
    error_message?: string | null;
    updated_at?: string;
  }) => {
    if (!payload.jobRunId) return;
    // @ts-expect-error Supabase 對 job_runs.update 推斷為 never
    await supabase.from("job_runs").update(patch).eq("id", payload.jobRunId);
  };

  const failJob = async (message: string, progress?: TtsBatchProgress) => {
    const result: TtsSynthesizeJobResult = progress
      ? buildJobResult(progress)
      : {
          ok: false,
          summary: { total: 0, done: 0, failed: 0, skipped: 0 },
        };
    await patchJob({
      status: "failed",
      result,
      error_message: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    });
  };

  let progress: TtsBatchProgress | undefined;

  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("composition_snapshot")
      .eq("id", payload.projectId)
      .single();

    if (projectError) throw new Error(projectError.message);

    const composition = (project as { composition_snapshot?: CourseComposition })
      ?.composition_snapshot;
    if (!composition?.steps?.length) {
      throw new Error("專案沒有可合成的步驟");
    }

    const targetSteps = payload.stepIds?.length
      ? composition.steps.filter((step) => payload.stepIds!.includes(step.id))
      : composition.steps;

    progress = createInitialTtsBatchProgress(
      targetSteps.map((step, index) => ({
        stepId: step.id,
        label: stepLabelFromScript(step.script, step.sortOrder ?? index),
        sortOrder: step.sortOrder ?? index,
        hasScript: Boolean(step.script.trim()),
      })),
    );

    let progressChain: Promise<void> = Promise.resolve();
    const emitProgress = async (): Promise<void> => {
      progressChain = progressChain.then(async () => {
        const partial = buildJobResult(progress!);
        await patchJob({
          status: "running",
          result: partial,
          updated_at: new Date().toISOString(),
        });
      });
      await progressChain;
    };

    if (payload.jobRunId) {
      console.log(
        `[tts-batch] start job=${payload.jobRunId} project=${payload.projectId} steps=${progress.totalSteps} provider=${payload.provider}`,
      );
      await patchJob({ status: "running", updated_at: new Date().toISOString() });
      await emitProgress();
    }

    let apiKey: string | undefined;
    if (payload.provider !== "edge-tts") {
      const { data: keyRow } = await supabase
        .from("user_api_keys")
        .select("encrypted_key")
        .eq("user_id", payload.userId)
        .eq("provider", payload.provider)
        .maybeSingle();
      const encrypted = (keyRow as { encrypted_key?: string } | null)?.encrypted_key;
      if (!encrypted) {
        throw new Error(`請先在設定頁填寫 ${payload.provider} API Key`);
      }
      apiKey = decryptApiKey(encrypted);
    }

    const audioEntries = [...composition.audio];

    for (let i = 0; i < targetSteps.length; i++) {
      const step = targetSteps[i]!;
      const stepIdx = progress.steps.findIndex((s) => s.stepId === step.id);
      if (stepIdx >= 0) {
        progress.currentStepIndex = stepIdx;
        progress.currentStepId = step.id;
        progress.currentLabel = progress.steps[stepIdx]!.label;
      }

      const ttsText = narrationTextForStep(step);
      if (!ttsText.trim()) {
        updateStepProgress(progress, step.id, { status: "skipped" });
        await emitProgress();
        continue;
      }

      const stepStartedAt = Date.now();
      updateStepProgress(progress, step.id, { status: "running" });
      progress.phase = "synthesize";
      progress.currentStepStartedAt = new Date(stepStartedAt).toISOString();
      await emitProgress();

      const progressHeartbeat = setInterval(() => {
        void emitProgress();
      }, STEP_PROGRESS_HEARTBEAT_MS);

      try {
        const buffer = await synthesizeStepAudio(
          payload.provider,
          ttsText,
          payload.voiceId,
          apiKey,
          payload.model,
        );

        const storagePath = `${payload.userId}/${payload.projectId}/audio/${step.id}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from("courseflow-assets")
          .upload(storagePath, buffer, {
            contentType: "audio/mpeg",
            upsert: true,
          });
        if (uploadError) {
          throw new Error(`音訊上傳失敗：${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from("courseflow-assets")
          .getPublicUrl(storagePath);
        const entry = {
          stepId: step.id,
          storagePath,
          publicUrl: urlData.publicUrl,
          durationMs: step.estimatedSeconds ? step.estimatedSeconds * 1000 : 3000,
        };
        const index = audioEntries.findIndex((item) => item.stepId === step.id);
        if (index >= 0) audioEntries[index] = entry;
        else audioEntries.push(entry);

        updateStepProgress(progress, step.id, { status: "done" });
        progress.stepDurationsMs.push(Date.now() - stepStartedAt);
        progress.currentStepStartedAt = undefined;
        await emitProgress();
        console.log(
          `[tts-batch] step done job=${payload.jobRunId ?? "-"} step=${step.id} elapsed=${Math.round((Date.now() - stepStartedAt) / 1000)}s`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "合成失敗";
        console.error(
          `[tts-batch] step failed job=${payload.jobRunId ?? "-"} step=${step.id}: ${message}`,
        );
        updateStepProgress(progress, step.id, { status: "failed", error: message });
        progress.stepDurationsMs.push(Date.now() - stepStartedAt);
        progress.currentStepStartedAt = undefined;
        await emitProgress();
      } finally {
        clearInterval(progressHeartbeat);
      }
    }

    await saveComposition(supabase, payload.projectId, {
      ...composition,
      audio: audioEntries,
    });

    progress.phase = "done";
    progress.currentStepIndex = progress.totalSteps;
    const jobResult = buildJobResult(progress);

    if (payload.jobRunId) {
      const firstError = progress.steps.find((s) => s.error)?.error;
      await patchJob({
        status: jobResult.ok ? "completed" : "failed",
        result: jobResult,
        error_message: jobResult.ok
          ? null
          : (firstError ?? `部分步驟合成失敗（${jobResult.summary.failed} 步）`),
        updated_at: new Date().toISOString(),
      });
      console.log(
        `[tts-batch] done job=${payload.jobRunId} project=${payload.projectId} done=${jobResult.summary.done}/${jobResult.summary.total} failed=${jobResult.summary.failed}`,
      );
    }

    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "語音合成失敗";
    console.error(`[tts-batch] job failed job=${payload.jobRunId ?? "-"}: ${message}`);
    if (payload.jobRunId) {
      await failJob(message, progress);
    }
    throw e;
  }
}
