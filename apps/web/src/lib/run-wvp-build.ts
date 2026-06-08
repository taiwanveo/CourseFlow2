import { createServiceClient } from "@/lib/supabase/admin";
import { syncFullWvpProject } from "@/lib/wvp-presentation-sync";
import { wvpEmbedBasePath, wvpPlayPagePath } from "@/lib/wvp-workdir";
import {
  createInitialWvpBuildProgress,
  type WvpBuildPhase,
  type WvpBuildProgress,
  type WvpBuildStageUpdate,
} from "@/lib/wvp-build-progress";
import type { WvpScreenTextAuditEntry } from "@/lib/wvp-step-text-audit";

export type WvpBuildJobResult = {
  ok?: boolean;
  chapterCount: number;
  previewUrl: string;
  embedUrl: string;
  storageUploaded?: boolean;
  warning?: string;
  audioSyncWarning?: string;
  illustrationSyncWarning?: string;
  chaptersVisualUpgraded?: string[];
  progress?: WvpBuildProgress;
  /** DEBUG 9d8c4f */
  screenTextAudit?: WvpScreenTextAuditEntry[];
};

export async function runWvpBuild(payload: {
  projectId: string;
  userId: string;
  jobRunId: string;
  themeId?: string;
}): Promise<WvpBuildJobResult> {
  const supabase = createServiceClient();
  let progress = createInitialWvpBuildProgress();
  let lastStageAt = Date.now();

  const patchJob = async (patch: {
    status: string;
    result?: WvpBuildJobResult;
    error_message?: string | null;
    updated_at?: string;
  }) => {
    // @ts-expect-error Supabase 客戶端對 job_runs.update 推斷為 never
    await supabase.from("job_runs").update(patch).eq("id", payload.jobRunId);
  };

  const emitStage = async (
    phase: WvpBuildPhase,
    update?: WvpBuildStageUpdate,
  ): Promise<void> => {
    const now = Date.now();
    const phaseChanged = phase !== progress.phase;
    if (phaseChanged) {
      progress.stageDurationsMs.push(now - lastStageAt);
      lastStageAt = now;
    }
    progress = {
      ...progress,
      phase,
      chapterCount: update?.chapterCount ?? progress.chapterCount,
      stageDurationsMs: [...progress.stageDurationsMs],
      subCurrent: update?.subCurrent,
      subTotal: update?.subTotal,
      subLabel: update?.subLabel,
    };
    if (phaseChanged && update?.subCurrent === undefined) {
      progress = {
        ...progress,
        subCurrent: undefined,
        subTotal: undefined,
        subLabel: undefined,
      };
    }
    const partial: WvpBuildJobResult = {
      ok: false,
      chapterCount: progress.chapterCount ?? 0,
      previewUrl: wvpPlayPagePath(payload.projectId),
      embedUrl: wvpEmbedBasePath(payload.projectId),
      progress,
    };
    await patchJob({
      status: "running",
      result: partial,
      updated_at: new Date().toISOString(),
    });
    const sub =
      progress.subCurrent !== undefined && progress.subTotal !== undefined
        ? ` sub=${progress.subCurrent}/${progress.subTotal}`
        : "";
    console.log(
      `[wvp-build] progress job=${payload.jobRunId} phase=${phase} chapters=${progress.chapterCount ?? "-"}${sub}`,
    );
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

  await patchJob({
    status: "running",
    result: {
      ok: false,
      chapterCount: 0,
      previewUrl: wvpPlayPagePath(payload.projectId),
      embedUrl: wvpEmbedBasePath(payload.projectId),
      progress,
    },
    updated_at: new Date().toISOString(),
  });
  const startedAt = Date.now();
  console.log(
    `[wvp-build] job start job=${payload.jobRunId} project=${payload.projectId} user=${payload.userId} theme=${payload.themeId ?? "default"}`,
  );

  try {
    console.log(`[wvp-build] job sync+build begin job=${payload.jobRunId} project=${payload.projectId}`);
    const result = await syncFullWvpProject(supabase, payload.projectId, payload.userId, {
      build: true,
      previewBase: wvpEmbedBasePath(payload.projectId),
      themeId: payload.themeId,
      onBuildStage: emitStage,
    });

    if (result.chapterCount === 0) {
      console.warn(`[wvp-build] job aborted job=${payload.jobRunId}: no chapters`);
      throw new Error("請先同步 narrations 並產生至少一章 AI 視覺計畫");
    }
    console.log(
      `[wvp-build] job sync+build ok job=${payload.jobRunId} chapters=${result.chapterCount} built=${result.built} storageUploaded=${result.storageUploaded}`,
    );

    await emitStage("done", { chapterCount: result.chapterCount });

    const jobResult: WvpBuildJobResult = {
      ok: true,
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
      screenTextAudit: result.screenTextAudit ? [...result.screenTextAudit] : undefined,
      progress,
    };

    await patchJob({
      status: "completed",
      result: jobResult,
      updated_at: new Date().toISOString(),
    });
    console.log(
      `[wvp-build] done job=${payload.jobRunId} in ${Math.round((Date.now() - startedAt) / 1000)}s chapters=${result.chapterCount}`,
    );
    return jobResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "建置失敗";
    console.error("[wvp-build] 背景建置失敗:", message);
    await patchJob({
      status: "failed",
      error_message: message.slice(0, 2000),
      result: {
        ok: false,
        chapterCount: progress.chapterCount ?? 0,
        previewUrl: wvpPlayPagePath(payload.projectId),
        embedUrl: wvpEmbedBasePath(payload.projectId),
        progress,
      },
      updated_at: new Date().toISOString(),
    });
    throw e;
  }
}
