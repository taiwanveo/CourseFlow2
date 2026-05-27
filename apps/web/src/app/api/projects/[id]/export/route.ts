import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { shouldUseJobQueue } from "@/lib/job-queue";
import { getRenderQueue } from "@/lib/queue";
import { canExportWvpMp4 } from "@/lib/wvp-export";
import { runWvpMp4Export } from "@/lib/run-wvp-render";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    quality?: "draft" | "standard" | "high";
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("edition, presentation_revision, wvp_phase_locks, phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const wvpLocks = resolveWvpPhaseLocks(project);
  if (!wvpLocks.craft && !wvpLocks.publish) {
    return NextResponse.json({ error: "請先完成並鎖定「視覺動效」" }, { status: 400 });
  }

  const useWvp = await canExportWvpMp4(supabase, id, user.id, project);

  const { data: job, error } = await supabase
    .from("render_jobs")
    .insert({
      project_id: id,
      user_id: user.id,
      kind: "export",
      status: "pending",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (useWvp) {
    const inline = process.env.COURSEFLOW_INLINE_JOBS === "1";
    const useQueue = !inline && (await shouldUseJobQueue());

    if (useQueue) {
      try {
        await getRenderQueue().add("render", {
          projectId: id,
          userId: user.id,
          renderJobId: job.id,
          kind: "export",
          pipeline: "wvp",
        });
        return NextResponse.json({ renderJob: job, pipeline: "wvp" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "無法加入佇列";
        await supabase
          .from("render_jobs")
          .update({ status: "failed", error_message: message })
          .eq("id", job.id);
        return NextResponse.json({ error: "無法開始 WVP 渲染佇列" }, { status: 503 });
      }
    }

    try {
      await supabase
        .from("render_jobs")
        .update({ status: "processing", progress: 5 })
        .eq("id", job.id);

      const { storagePath } = await runWvpMp4Export({
        projectId: id,
        userId: user.id,
        renderJobId: job.id,
        onProgress: async (n) => {
          await supabase.from("render_jobs").update({ progress: n }).eq("id", job.id);
        },
      });

      await supabase
        .from("render_jobs")
        .update({
          status: "completed",
          progress: 100,
          output_path: storagePath,
          error_message: null,
        })
        .eq("id", job.id);

      return NextResponse.json({ renderJob: job, pipeline: "wvp", inline: true });
    } catch (e) {
      const message = (e as Error).message;
      await supabase
        .from("render_jobs")
        .update({ status: "failed", error_message: message })
        .eq("id", job.id);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // --- 舊版 HyperFrames（非 v2 或未建置 WVP）---
  const locks = project.phase_locks as { visual?: boolean };
  if (!locks.visual) {
    return NextResponse.json({ error: "請先建置 WVP 預覽，或鎖定舊版視覺階段" }, { status: 400 });
  }

  if (!(await shouldUseJobQueue())) {
    await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        error_message:
          "未偵測到 background worker。請啟動 courseflow-worker，或設 COURSEFLOW_INLINE_JOBS=1 走 WVP 內嵌錄製。",
      })
      .eq("id", job.id);
    return NextResponse.json(
      {
        error:
          "舊版 HyperFrames 匯出需要 worker。v2 專案請先「建置 WVP 預覽」後再匯出（可走 Playwright 內嵌）。",
      },
      { status: 503 },
    );
  }

  try {
    await getRenderQueue().add("render", {
      projectId: id,
      userId: user.id,
      renderJobId: job.id,
      kind: "export",
      quality:
        body.quality === "draft" || body.quality === "standard" || body.quality === "high"
          ? body.quality
          : "standard",
      pipeline: "legacy",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "無法加入渲染佇列";
    await supabase
      .from("render_jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", job.id);
    return NextResponse.json({ error: "無法開始渲染" }, { status: 503 });
  }

  return NextResponse.json({ renderJob: job, pipeline: "legacy" });
}
