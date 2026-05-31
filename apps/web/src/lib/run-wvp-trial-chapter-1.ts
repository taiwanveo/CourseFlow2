import type { LlmProviderId } from "@courseflow/llm";
import { createServiceClient } from "@/lib/supabase/admin";
import { resolveEffectiveTextModel, resolveLlmProvider } from "@/lib/llm-provider";
import { runAnchorChapterTrial } from "@/lib/wvp-chapter-craft";

export type WvpTrialChapter1JobResult = {
  ok: boolean;
  wvpChapterId?: string;
  templateKind?: string;
  chapterSource?: "llm" | "template";
  previewUrl?: string;
  illustrationSyncWarning?: string;
};

export async function runWvpTrialChapter1(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  provider?: LlmProviderId;
  themeId: string;
}): Promise<WvpTrialChapter1JobResult> {
  const supabase = createServiceClient();

  const patchJob = async (patch: {
    status: string;
    result?: WvpTrialChapter1JobResult;
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
    `[wvp-trial-job] start job=${payload.jobRunId} project=${payload.projectId}`,
  );

  try {
    const resolved = await resolveLlmProvider(supabase, payload.userId, payload.provider);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const result = await runAnchorChapterTrial(supabase, payload.projectId, payload.userId, {
      provider: resolved.provider,
      encryptedKey: resolved.encryptedKey,
      textModel: resolveEffectiveTextModel(
        resolved.provider,
        resolved.textModel,
        resolved.defaultModel,
      ),
      themeId: payload.themeId,
    });

    if (!result.ok) {
      throw new Error(result.error ?? "試執行失敗");
    }

    const jobResult: WvpTrialChapter1JobResult = {
      ok: true,
      wvpChapterId: result.wvpChapterId,
      templateKind: result.templateKind,
      chapterSource: result.chapterSource,
      previewUrl: result.previewUrl,
      illustrationSyncWarning: result.illustrationSyncWarning,
    };

    await patchJob({ status: "completed", result: jobResult });
    console.log(
      `[wvp-trial-job] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "試執行失敗";
    console.error("[wvp-trial-job] 背景任務失敗:", message);
    await patchJob({ status: "failed", error_message: message.slice(0, 2000) });
    throw e;
  }
}
