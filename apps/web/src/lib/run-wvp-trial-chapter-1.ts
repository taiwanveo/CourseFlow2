import type { LlmProviderId } from "@courseflow/llm";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolveEffectiveTextModel, resolveLlmProvider } from "@/lib/llm-provider";
import { resolveTrialJobTimeoutMs } from "@/lib/wvp-craft-async";
import { runAnchorChapterTrial } from "@/lib/wvp-chapter-craft";
import {
  advanceTrialProgress,
  createInitialTrialProgress,
  type WvpTrialChapterProgress,
} from "@/lib/wvp-trial-progress";

export type WvpTrialChapter1JobResult = {
  ok: boolean;
  progress?: WvpTrialChapterProgress;
  wvpChapterId?: string;
  templateKind?: string;
  chapterSource?: "llm" | "template";
  previewUrl?: string;
  illustrationSyncWarning?: string;
};

const HEARTBEAT_INTERVAL_MS = 15_000;

function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 逾時（>${Math.round(timeoutMs / 1000)}s）`));
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

export async function runWvpTrialChapter1(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  provider?: LlmProviderId;
  themeId: string;
}): Promise<WvpTrialChapter1JobResult> {
  const supabase = createServiceClient();

  const patchJob = async (patch: {
    status?: "pending" | "running" | "completed" | "failed";
    result?: WvpTrialChapter1JobResult;
    error_message?: string | null;
    updated_at?: string;
  }) => {
    // @ts-expect-error Supabase 對 job_runs.update 推斷為 never
    await supabase.from("job_runs").update(patch).eq("id", payload.jobRunId);
  };

  const { data: owned } = await supabase
    .from("projects")
    .select("id")
    .eq("id", payload.projectId)
    .eq("user_id", payload.userId)
    .maybeSingle();
  if (!owned) {
    await patchJob({ status: "failed", error_message: "找不到專案" });
    throw new Error("找不到專案");
  }

  let latestProgress = createInitialTrialProgress();
  const patchRunningProgress = async (progress: WvpTrialChapterProgress) => {
    latestProgress = progress;
    const partial: WvpTrialChapter1JobResult = { ok: false, progress };
    await patchJob({
      status: "running",
      result: partial,
      updated_at: new Date().toISOString(),
    });
  };

  await patchRunningProgress(latestProgress);
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void patchJob({
      status: "running",
      result: { ok: false, progress: latestProgress },
      updated_at: new Date().toISOString(),
    });
  }, HEARTBEAT_INTERVAL_MS);
  console.log(
    `[wvp-trial-job] start job=${payload.jobRunId} project=${payload.projectId}`,
  );

  try {
    const resolved = await resolveLlmProvider(supabase, payload.userId, payload.provider);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const timeoutMs = resolveTrialJobTimeoutMs();
    const result = await withTimeout(
      runAnchorChapterTrial(supabase, payload.projectId, payload.userId, {
        provider: resolved.provider,
        encryptedKey: resolved.encryptedKey,
        textModel: resolveEffectiveTextModel(
          resolved.provider,
          resolved.textModel,
          resolved.defaultModel,
        ),
        themeId: payload.themeId,
        onStage: async (stage) => {
          console.info(`[wvp-trial-job] stage=${stage} job=${payload.jobRunId}`);
          const next = advanceTrialProgress(latestProgress, stage);
          await patchRunningProgress({
            ...next,
            subCurrent: undefined,
            subTotal: undefined,
            subLabel: undefined,
            uploadStartedAt:
              stage === "dist-upload-start"
                ? new Date().toISOString()
                : undefined,
          });
        },
        onUploadProgress: async ({ current, total, relPath }) => {
          const done = total > 0 && current >= total;
          await patchRunningProgress({
            ...latestProgress,
            phase: "dist-upload-start",
            uploadStartedAt: latestProgress.uploadStartedAt ?? new Date().toISOString(),
            subCurrent: current,
            subTotal: Math.max(total, 1),
            subLabel: done
              ? "上傳完成"
              : total > 0
                ? `檔案 ${current}/${total}`
                : relPath,
          });
        },
      }),
      timeoutMs,
      "第 1 章試執行背景任務",
    );

    if (!result.ok) {
      throw new Error(result.error ?? "試執行失敗");
    }

    const jobResult: WvpTrialChapter1JobResult = {
      ok: true,
      progress: advanceTrialProgress(latestProgress, "preview-built"),
      wvpChapterId: result.wvpChapterId,
      templateKind: result.templateKind,
      chapterSource: result.chapterSource,
      previewUrl: result.previewUrl,
      illustrationSyncWarning: result.illustrationSyncWarning,
    };

    await patchJob({ status: "completed", result: jobResult, updated_at: new Date().toISOString() });
    console.log(
      `[wvp-trial-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "試執行失敗";
    console.error("[wvp-trial-job] 背景任務失敗:", message);
    await patchJob({
      status: "failed",
      error_message: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    });
    throw e;
  } finally {
    clearInterval(heartbeat);
  }
}
