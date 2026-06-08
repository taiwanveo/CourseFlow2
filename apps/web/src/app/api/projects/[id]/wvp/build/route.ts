import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { runWvpBuild } from "@/lib/run-wvp-build";
import { createInitialWvpBuildProgress } from "@/lib/wvp-build-progress";
import { isStaleJob } from "@/lib/job-runs-stale";
import { resolveJobStaleMs } from "@/lib/wvp-craft-async";
import { shouldAsyncWvpBuild } from "@/lib/wvp-build-async";
import { syncFullWvpProject } from "@/lib/wvp-presentation-sync";
import { wvpEmbedBasePath, wvpPlayPagePath } from "@/lib/wvp-workdir";
import { parseWvpBuildProgress } from "@/lib/wvp-build-progress";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 查詢進行中的打包任務（重新整理頁面後可接續輪詢） */
export async function GET(
  _req: NextRequest,
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
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const staleMs = resolveJobStaleMs();
  const { data: existingJob } = await supabase
    .from("job_runs")
    .select("id, status, updated_at, created_at, result, error_message")
    .eq("project_id", id)
    .eq("job_type", "wvp-build")
    .in("status", ["pending", "running", "cancelling"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingJob?.id) {
    return NextResponse.json({ active: false });
  }

  const stale = isStaleJob(existingJob.updated_at, existingJob.created_at, staleMs);
  if (stale) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("job_runs")
      .update({
        status: "failed",
        error_message: `任務逾時未更新（>${Math.round(staleMs / 1000)}s），已自動結束`,
        updated_at: nowIso,
      })
      .eq("id", existingJob.id)
      .in("status", ["pending", "running", "cancelling"]);
    return NextResponse.json({
      active: false,
      staleCleared: true,
      clearedJobRunId: existingJob.id,
    });
  }

  const result = existingJob.result as Record<string, unknown> | null;
  return NextResponse.json({
    active: true,
    jobRunId: existingJob.id,
    status: existingJob.status,
    progress: parseWvpBuildProgress(result),
    errorMessage: existingJob.error_message,
  });
}

/** M3：建置 WVP presentation（Vite build）供 /wvp-play 預覽 */
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
    .select("id, wvp_settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const styleGuard = assertProjectImageStyleConfigured(project.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    themeId?: string;
    /** 結束進行中／僵死任務後重新建立打包 */
    forceRestart?: boolean;
  };
  const requestedThemeId =
    typeof body.themeId === "string" && body.themeId.trim() ? body.themeId.trim() : undefined;
  const forceRestart = body.forceRestart === true;

  try {
    const composition = await loadProjectComposition(supabase, id);
    if (!composition) {
      return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
    }
    const audioGate = evaluateWvpAudioBuildGate(composition);
    if (!audioGate.ready) {
      return NextResponse.json(
        {
          error: audioGate.message,
          audioGate,
        },
        { status: 400 },
      );
    }

    console.log(
      `[wvp-build] POST project=${id} user=${user.id} async=${shouldAsyncWvpBuild()} theme=${requestedThemeId ?? "default"}`,
    );

    if (shouldAsyncWvpBuild()) {
      const staleMs = resolveJobStaleMs();
      const { data: existingJob } = await supabase
        .from("job_runs")
        .select("id, status, updated_at, created_at")
        .eq("project_id", id)
        .eq("job_type", "wvp-build")
        .in("status", ["pending", "running", "cancelling"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob?.id) {
        const stale = isStaleJob(
          existingJob.updated_at,
          existingJob.created_at,
          staleMs,
        );
        if (forceRestart || stale) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("job_runs")
            .update({
              status: "failed",
              error_message: stale
                ? `任務逾時未更新（>${Math.round(staleMs / 1000)}s），已自動結束`
                : "使用者要求重新打包，已結束舊任務",
              updated_at: nowIso,
            })
            .eq("id", existingJob.id)
            .in("status", ["pending", "running", "cancelling"]);
          console.warn(
            `[wvp-build] cleared existing job=${existingJob.id} project=${id} stale=${stale} forceRestart=${forceRestart}`,
          );
        } else {
          console.log(`[wvp-build] reuse running job=${existingJob.id} project=${id}`);
          return NextResponse.json(
            {
              ok: true,
              queued: true,
              jobRunId: existingJob.id,
              message: "已有打包任務進行中，請稍候…",
            },
            { status: 202 },
          );
        }
      }

      const chapterCount = composition.chapters.filter((ch) => !ch.parentId).length;
      const initialProgress = createInitialWvpBuildProgress(chapterCount);
      const initialResult = {
        ok: false,
        chapterCount,
        previewUrl: wvpPlayPagePath(id),
        embedUrl: wvpEmbedBasePath(id),
        progress: initialProgress,
      };

      const { data: jobRun, error: jobError } = await supabase
        .from("job_runs")
        .insert({
          project_id: id,
          user_id: user.id,
          job_type: "wvp-build",
          status: "pending",
          result: initialResult,
          payload: { themeId: requestedThemeId },
        })
        .select("id")
        .single();

      if (jobError || !jobRun) {
        return NextResponse.json(
          { error: jobError?.message ?? "無法建立建置任務" },
          { status: 500 },
        );
      }

      const buildPayload = {
        projectId: id,
        userId: user.id,
        jobRunId: jobRun.id,
        themeId: requestedThemeId,
      };
      console.log(`[wvp-build] created job=${jobRun.id} project=${id} dispatch=web-inline`);
      // Render Docker 長駐程序：setImmediate 比 after() 更可靠，避免任務卡在 pending
      setImmediate(() => {
        void runWvpBuild(buildPayload).catch((err) => {
          console.error(`[wvp-build] inline failed job=${jobRun.id}:`, err);
        });
      });

      return NextResponse.json(
        {
          ok: true,
          queued: true,
          jobRunId: jobRun.id,
          message: "課程打包已開始，請稍候（首次可能需數分鐘）",
        },
        { status: 202 },
      );
    }

    console.log(`[wvp-build] sync inline project=${id}`);
    const result = await syncFullWvpProject(supabase, id, user.id, {
      build: true,
      previewBase: wvpEmbedBasePath(id),
      themeId: requestedThemeId,
    });
    console.log(
      `[wvp-build] sync inline done project=${id} chapters=${result.chapterCount} built=${result.built}`,
    );
    if (result.chapterCount === 0) {
      return NextResponse.json(
        { error: "請先同步 narrations 並產生至少一章 AI 視覺計畫" },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      chapterCount: result.chapterCount,
      previewUrl: wvpPlayPagePath(id),
      embedUrl: wvpEmbedBasePath(id),
      built: result.built,
      storageUploaded: result.storageUploaded,
      warning:
        result.storageUploadWarning ??
        result.audioSyncWarning ??
        result.illustrationSyncWarning,
      audioSyncWarning: result.audioSyncWarning,
      illustrationSyncWarning: result.illustrationSyncWarning,
      chaptersVisualUpgraded: result.chaptersVisualUpgraded ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
