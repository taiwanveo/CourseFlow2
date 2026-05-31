import type { LlmProviderId } from "@courseflow/llm";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolveEffectiveTextModel, resolveLlmProvider } from "@/lib/llm-provider";
import { batchCraftAllChapters, batchCraftAllChaptersAndBuild } from "@/lib/wvp-chapter-craft";

export type WvpBatchCraftJobResult = {
  ok: boolean;
  mode: "batch-craft" | "batch-craft-build";
  summary: {
    total: number;
    synced: number;
    generated: number;
    failed: number;
    built?: boolean;
  };
  warning?: string;
};

export async function runWvpBatchCraft(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  provider?: LlmProviderId;
  onlyMissing: boolean;
  includeBuild: boolean;
}): Promise<WvpBatchCraftJobResult> {
  const supabase = createServiceClient();

  const patchJob = async (patch: {
    status: string;
    result?: WvpBatchCraftJobResult;
    error_message?: string | null;
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

  await patchJob({ status: "running" });
  const startedAt = Date.now();
  console.log(
    `[wvp-batch-job] start job=${payload.jobRunId} project=${payload.projectId} includeBuild=${payload.includeBuild}`,
  );

  try {
    const resolved = await resolveLlmProvider(supabase, payload.userId, payload.provider);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    if (payload.includeBuild) {
      const { results, build } = await batchCraftAllChaptersAndBuild(
        supabase,
        payload.projectId,
        payload.userId,
        {
          provider: resolved.provider,
          encryptedKey: resolved.encryptedKey,
          textModel: resolveEffectiveTextModel(
            resolved.provider,
            resolved.textModel,
            resolved.defaultModel,
          ),
          onlyMissing: payload.onlyMissing,
        },
      );

      const failed = results.filter((r) => r.error).length;
      const generated = results.filter((r) => r.generated).length;
      const jobResult: WvpBatchCraftJobResult = {
        ok: failed === 0 && build.built,
        mode: "batch-craft-build",
        summary: {
          total: results.length,
          synced: results.filter((r) => r.synced).length,
          generated,
          failed,
          built: build.built,
        },
        warning: build.storageUploadWarning ?? build.audioSyncWarning,
      };

      await patchJob({ status: "completed", result: jobResult });
      console.log(
        `[wvp-batch-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s mode=build`,
      );
      return jobResult;
    }

    const { results } = await batchCraftAllChapters(supabase, payload.projectId, payload.userId, {
      provider: resolved.provider,
      encryptedKey: resolved.encryptedKey,
      textModel: resolveEffectiveTextModel(
        resolved.provider,
        resolved.textModel,
        resolved.defaultModel,
      ),
      onlyMissing: payload.onlyMissing,
    });

    const failed = results.filter((r) => r.error).length;
    const generated = results.filter((r) => r.generated).length;
    const jobResult: WvpBatchCraftJobResult = {
      ok: failed === 0,
      mode: "batch-craft",
      summary: {
        total: results.length,
        synced: results.filter((r) => r.synced).length,
        generated,
        failed,
      },
    };

    await patchJob({ status: "completed", result: jobResult });
    console.log(
      `[wvp-batch-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s mode=craft`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "批次執行失敗";
    console.error("[wvp-batch-job] 背景任務失敗:", message);
    await patchJob({ status: "failed", error_message: message.slice(0, 2000) });
    throw e;
  }
}
