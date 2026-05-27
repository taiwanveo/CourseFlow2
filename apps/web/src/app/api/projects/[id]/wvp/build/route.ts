import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadProjectComposition } from "@/lib/project-composition";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { runWvpBuild } from "@/lib/run-wvp-build";
import { shouldAsyncWvpBuild } from "@/lib/wvp-build-async";
import { syncFullWvpProject } from "@/lib/wvp-presentation-sync";
import { wvpEmbedBasePath, wvpPlayPagePath } from "@/lib/wvp-workdir";

export const runtime = "nodejs";
export const maxDuration = 300;

/** M3：建置 WVP presentation（Vite build）供 /wvp-play 預覽 */
export async function POST(
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
    .select("id, wvp_settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const styleGuard = assertProjectImageStyleConfigured(project.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }

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

    if (shouldAsyncWvpBuild()) {
      const { data: jobRun, error: jobError } = await supabase
        .from("job_runs")
        .insert({
          project_id: id,
          user_id: user.id,
          job_type: "wvp-build",
          status: "pending",
          payload: {},
        })
        .select("id")
        .single();

      if (jobError || !jobRun) {
        return NextResponse.json(
          { error: jobError?.message ?? "無法建立建置任務" },
          { status: 500 },
        );
      }

      void runWvpBuild({
        projectId: id,
        userId: user.id,
        jobRunId: jobRun.id,
      }).catch((err) => {
        console.error("[wvp-build] 背景建置失敗:", err);
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

    const result = await syncFullWvpProject(supabase, id, user.id, {
      build: true,
      previewBase: wvpEmbedBasePath(id),
    });
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
