import type { LlmProviderId } from "@courseflow/llm";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolveEffectiveTextModel, resolveLlmProvider } from "@/lib/llm-provider";
import { batchCraftAllChapters, batchCraftAllChaptersAndBuild } from "@/lib/wvp-chapter-craft";
import type {
  WvpBatchCraftJobResult,
  WvpBatchCraftProgress,
} from "@courseflow/wvp-craft";

export type { WvpBatchCraftJobResult };

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function runWvpBatchCraft(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  provider?: LlmProviderId;
  onlyMissing: boolean;
  includeBuild: boolean;
  resumeFromSortOrder?: number;
}): Promise<WvpBatchCraftJobResult> {
  const supabase = createServiceClient();
  let latestProgress: WvpBatchCraftProgress | undefined;

  const patchJob = async (patch: {
    status: string;
    result?: WvpBatchCraftJobResult;
    error_message?: string | null;
    updated_at?: string;
  }) => {
    // @ts-expect-error Supabase 對 job_runs.update 推斷為 never
    await supabase.from("job_runs").update(patch).eq("id", payload.jobRunId);
  };

  const isCancelled = async (): Promise<boolean> => {
    const { data: job } = await supabase
      .from("job_runs")
      .select("status")
      .eq("id", payload.jobRunId)
      .maybeSingle();
    const status = (job as { status?: string } | null)?.status;
    return status === "cancelled" || status === "cancelling";
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

  await patchJob({ status: "running", updated_at: new Date().toISOString() });
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    void patchJob({ status: "running", updated_at: new Date().toISOString() });
  }, HEARTBEAT_INTERVAL_MS);

  console.log(
    `[wvp-batch-job] start job=${payload.jobRunId} project=${payload.projectId} user=${payload.userId} onlyMissing=${payload.onlyMissing} includeBuild=${payload.includeBuild} resumeFrom=${payload.resumeFromSortOrder ?? "none"}`,
  );

  try {
    const resolved = await resolveLlmProvider(supabase, payload.userId, payload.provider);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const craftOpts = {
      provider: resolved.provider,
      encryptedKey: resolved.encryptedKey,
      textModel: resolveEffectiveTextModel(
        resolved.provider,
        resolved.textModel,
        resolved.defaultModel,
      ),
      onlyMissing: payload.onlyMissing,
      resumeFromSortOrder: payload.resumeFromSortOrder,
      skipLlmTsx: true,
      isCancelled,
      onProgress: async (progress: WvpBatchCraftProgress) => {
        latestProgress = progress;
        const done = progress.chapters.filter((ch) =>
          ["materialized", "skipped", "failed"].includes(ch.status),
        ).length;
        const running = progress.chapters.find((ch) => ch.status === "running");
        console.log(
          `[wvp-batch-job] progress job=${payload.jobRunId} project=${payload.projectId} phase=${progress.phase} done=${done}/${progress.totalChapters} current=${progress.currentTitle ?? running?.title ?? "-"} chStatus=${running?.status ?? "-"}`,
        );
        const partial: WvpBatchCraftJobResult = {
          ok: false,
          mode: payload.includeBuild ? "batch-craft-build" : "batch-craft",
          progress,
          summary: {
            total: progress.totalChapters,
            synced: progress.chapters.filter((ch) =>
              ["synced", "generated", "materialized"].includes(ch.status),
            ).length,
            generated: progress.chapters.filter((ch) =>
              ["generated", "materialized"].includes(ch.status),
            ).length,
            failed: progress.chapters.filter((ch) => ch.status === "failed").length,
          },
        };
        await patchJob({
          status: "running",
          result: partial,
          updated_at: new Date().toISOString(),
        });
      },
    };

    if (payload.includeBuild) {
      const { results, build } = await batchCraftAllChaptersAndBuild(
        supabase,
        payload.projectId,
        payload.userId,
        craftOpts,
      );

      const failed = results.filter((r) => r.error).length;
      const generated = results.filter((r) => r.generated).length;
      const cancelled = await isCancelled();
      const jobResult: WvpBatchCraftJobResult = {
        ok: !cancelled && failed === 0 && build.built,
        mode: "batch-craft-build",
        progress: latestProgress,
        summary: {
          total: results.length,
          synced: results.filter((r) => r.synced).length,
          generated,
          failed,
          built: build.built,
        },
        warning: build.storageUploadWarning ?? build.audioSyncWarning,
        cancelled,
      };

      await patchJob({
        status: cancelled ? "cancelled" : "completed",
        result: jobResult,
        updated_at: new Date().toISOString(),
      });
      console.log(
        `[wvp-batch-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s mode=build`,
      );
      return jobResult;
    }

    const { results } = await batchCraftAllChapters(
      supabase,
      payload.projectId,
      payload.userId,
      craftOpts,
    );

    const failed = results.filter((r) => r.error).length;
    const generated = results.filter((r) => r.generated).length;
    const cancelled = await isCancelled();
    const jobResult: WvpBatchCraftJobResult = {
      ok: !cancelled && failed === 0,
      mode: "batch-craft",
      progress: latestProgress,
      summary: {
        total: results.length,
        synced: results.filter((r) => r.synced).length,
        generated,
        failed,
      },
      cancelled,
    };

    await patchJob({
      status: cancelled ? "cancelled" : "completed",
      result: jobResult,
      updated_at: new Date().toISOString(),
    });
    console.log(
      `[wvp-batch-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s mode=craft`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "批次執行失敗";
    console.error("[wvp-batch-job] 背景任務失敗:", message);
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
