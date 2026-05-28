import { createServiceClient } from "@/lib/supabase/admin";
import { syncFullWvpProject } from "@/lib/wvp-presentation-sync";
import { wvpEmbedBasePath, wvpPlayPagePath } from "@/lib/wvp-workdir";

export type WvpBuildJobResult = {
  chapterCount: number;
  previewUrl: string;
  embedUrl: string;
  storageUploaded?: boolean;
  warning?: string;
  audioSyncWarning?: string;
  illustrationSyncWarning?: string;
  chaptersVisualUpgraded?: string[];
};

export async function runWvpBuild(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  themeId?: string;
}): Promise<WvpBuildJobResult> {
  const supabase = createServiceClient();

  const patchJob = async (patch: {
    status: string;
    result?: WvpBuildJobResult;
    error_message?: string | null;
  }) => {
    // @ts-expect-error Supabase 客戶端對 job_runs.update 推斷為 never
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
    `[wvp-build] start job=${payload.jobRunId} project=${payload.projectId}`,
  );

  try {
    const result = await syncFullWvpProject(supabase, payload.projectId, payload.userId, {
      build: true,
      previewBase: wvpEmbedBasePath(payload.projectId),
      themeId: payload.themeId,
    });

    if (result.chapterCount === 0) {
      throw new Error("請先同步 narrations 並產生至少一章 AI 視覺計畫");
    }

    const jobResult: WvpBuildJobResult = {
      chapterCount: result.chapterCount,
      previewUrl: wvpPlayPagePath(payload.projectId),
      embedUrl: wvpEmbedBasePath(payload.projectId),
      storageUploaded: result.storageUploaded,
      warning:
        result.storageUploadWarning ??
        result.audioSyncWarning ??
        result.illustrationSyncWarning,
      audioSyncWarning: result.audioSyncWarning,
      illustrationSyncWarning: result.illustrationSyncWarning,
      chaptersVisualUpgraded: result.chaptersVisualUpgraded,
    };

    await patchJob({ status: "completed", result: jobResult });
    console.log(
      `[wvp-build] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s chapters=${result.chapterCount}`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "建置失敗";
    console.error("[wvp-build] 背景建置失敗:", message);
    await patchJob({ status: "failed", error_message: message.slice(0, 2000) });
    throw e;
  }
}
