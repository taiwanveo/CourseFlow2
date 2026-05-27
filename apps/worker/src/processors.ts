// @ts-nocheck
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@courseflow/db";
import { synthesizeSpeech } from "@courseflow/tts";
import type { TtsProviderId } from "@courseflow/tts";
import { compileToHyperFrames } from "@courseflow/hf-bridge";
import { runHyperFramesRender } from "./render-hyperframes.js";
import { ensureChapterDividerSteps, type CourseComposition } from "@courseflow/core";
import { decryptApiKey } from "@courseflow/shared";
import { parseBuffer } from "music-metadata";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = ReturnType<typeof createServiceClient> & { from: (t: string) => any };

async function downloadStorageAsset(
  supabase: Supabase,
  storagePath: string,
  destPath: string,
): Promise<void> {
  const { data, error } = await supabase.storage.from("courseflow-assets").download(storagePath);
  if (error || !data) {
    throw new Error(`無法下載資產 ${storagePath}: ${error?.message ?? "空檔案"}`);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, Buffer.from(await data.arrayBuffer()));
}

async function downloadCompositionAssets(
  supabase: Supabase,
  composition: CourseComposition,
  workDir: string,
): Promise<void> {
  for (const a of composition.audio) {
    if (!a.storagePath) continue;
    await downloadStorageAsset(
      supabase,
      a.storagePath,
      join(workDir, "assets", "audio", `${a.stepId}.mp3`),
    );
  }

  for (const v of composition.visuals) {
    for (const el of v.elements) {
      if (el.type === "image" && el.storagePath) {
        const name = el.storagePath.split("/").pop()!;
        await downloadStorageAsset(
          supabase,
          el.storagePath,
          join(workDir, "assets", "images", name),
        );
      }
    }
    if (v.background.storagePath) {
      const name = v.background.storagePath.split("/").pop()!;
      await downloadStorageAsset(
        supabase,
        v.background.storagePath,
        join(workDir, "assets", "images", name),
      );
    }
  }

  if (composition.bgm.storagePath) {
    await downloadStorageAsset(
      supabase,
      composition.bgm.storagePath,
      join(workDir, "assets", "bgm.mp3"),
    );
  }
}

export async function processSynthesizeAudio(payload: {
  projectId: string;
  userId: string;
  provider: TtsProviderId;
  voiceId: string;
  model?: string;
  stepIds?: string[];
  jobRunId?: string;
}) {
  const supabase = createServiceClient() as Supabase;

  const markJob = async (status: "completed" | "failed", errorMessage?: string) => {
    if (!payload.jobRunId) return;
    await supabase
      .from("job_runs")
      .update({
        status,
        error_message: errorMessage ?? null,
      })
      .eq("id", payload.jobRunId);
  };

  try {
  const { data: project } = await supabase
    .from("projects")
    .select("composition_snapshot")
    .eq("id", payload.projectId)
    .single();
  const composition = (project as unknown as { composition_snapshot?: CourseComposition })
    ?.composition_snapshot;
  if (!composition?.steps?.length) {
    await markJob("failed", "專案沒有可合成的步驟");
    return;
  }

  let apiKey: string | undefined;
  if (payload.provider !== "edge-tts") {
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", payload.userId)
      .eq("provider", payload.provider)
      .maybeSingle();
    const enc = (keyRow as { encrypted_key?: string } | null)?.encrypted_key;
    if (enc) apiKey = decryptApiKey(enc);
  }

  const audioEntries = [...composition.audio];
  const targetSteps = payload.stepIds?.length
    ? composition.steps.filter((step) => payload.stepIds!.includes(step.id))
    : composition.steps;

  for (const step of targetSteps) {
    if (!step.script.trim()) continue;

    const buf = await synthesizeSpeech(
      payload.provider,
      step.script,
      payload.voiceId,
      { provider: payload.provider, apiKey },
      payload.model ? { model: payload.model } : undefined,
    );
    const path = `${payload.userId}/${payload.projectId}/audio/${step.id}.mp3`;
    await supabase.storage.from("courseflow-assets").upload(path, buf, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    const { data: urlData } = supabase.storage
      .from("courseflow-assets")
      .getPublicUrl(path);
    let durationMs = step.estimatedSeconds ? step.estimatedSeconds * 1000 : 3000;
    try {
      const meta = await parseBuffer(buf, { mimeType: "audio/mpeg" });
      durationMs = Math.round((meta.format.duration ?? 3) * 1000);
    } catch {
      /* estimate */
    }
    const idx = audioEntries.findIndex((a) => a.stepId === step.id);
    const entry = {
      stepId: step.id,
      storagePath: path,
      publicUrl: urlData.publicUrl,
      durationMs,
    };
    if (idx >= 0) audioEntries[idx] = entry;
    else audioEntries.push(entry);
  }

  await (supabase.from("projects") as { update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> } })
    .update({ composition_snapshot: { ...composition, audio: audioEntries } })
    .eq("id", payload.projectId);

  await markJob("completed");
  } catch (e) {
    await markJob("failed", (e as Error).message);
    throw e;
  }
}

export async function processRender(payload: {
  projectId: string;
  userId: string;
  renderJobId: string;
  kind: "preview" | "export";
  quality?: "draft" | "standard" | "high";
  pipeline?: "wvp" | "legacy";
}) {
  if (payload.pipeline === "wvp") {
    const { processRenderWvp } = await import("./process-render-wvp.js");
    const supabase = createServiceClient() as Supabase;
    const jobs = supabase.from("render_jobs") as {
      update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> };
    };
    try {
      await jobs
        .update({ status: "processing", progress: 5, error_message: null })
        .eq("id", payload.renderJobId);
      const storagePath = await processRenderWvp({
        projectId: payload.projectId,
        userId: payload.userId,
        renderJobId: payload.renderJobId,
        onProgress: async (n) => {
          await jobs.update({ progress: n }).eq("id", payload.renderJobId);
        },
      });
      await jobs
        .update({ status: "completed", progress: 100, output_path: storagePath, error_message: null })
        .eq("id", payload.renderJobId);
      console.log(`[render:wvp] ${payload.renderJobId} 完成 → ${storagePath}`);
      return;
    } catch (e) {
      const message = (e as Error).message;
      console.error(`[render:wvp] ${payload.renderJobId} 失敗:`, message);
      await jobs
        .update({ status: "failed", progress: 0, error_message: message })
        .eq("id", payload.renderJobId);
      throw e;
    }
  }

  const supabase = createServiceClient() as Supabase;

  const jobs = supabase.from("render_jobs") as {
    update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> };
  };

  const setProgress = async (progress: number) => {
    await jobs.update({ progress }).eq("id", payload.renderJobId);
  };

  const failJob = async (message: string) => {
    await jobs
      .update({ status: "failed", progress: 0, error_message: message })
      .eq("id", payload.renderJobId);
  };

  let workDir: string | null = null;

  try {
    await jobs
      .update({ status: "processing", progress: 5, error_message: null })
      .eq("id", payload.renderJobId);

    const { data: project } = await supabase
      .from("projects")
      .select("composition_snapshot")
      .eq("id", payload.projectId)
      .single();
    const raw = (project as unknown as { composition_snapshot?: CourseComposition })
      ?.composition_snapshot;
    if (!raw) throw new Error("無 composition");
    const composition = ensureChapterDividerSteps(raw);

    workDir = join(tmpdir(), `cf-render-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });

    await setProgress(15);
    await downloadCompositionAssets(supabase, composition, workDir);
    await setProgress(28);

    const hfProject = compileToHyperFrames(composition, workDir, {
      localAssets: true,
      includeSubtitles: false,
    });
    await setProgress(38);

    const outLocal = join(workDir, "output.mp4");
    const quality =
      payload.quality ??
      (payload.kind === "preview" ? "draft" : "standard");

    console.log(
      `[render] ${payload.renderJobId} 開始 HyperFrames（quality=${quality}，約 ${Math.round(hfProject.totalDurationSec)}s 影片）→ ${outLocal}`,
    );

    await runHyperFramesRender(workDir, {
      quality,
      outputPath: outLocal,
      estimatedDurationSec: hfProject.totalDurationSec,
      onProgress: setProgress,
    });

    if (!existsSync(outLocal)) {
      throw new Error("渲染完成但未產生 output.mp4");
    }

    const fileBuf = readFileSync(outLocal);
    if (fileBuf.length < 4096) {
      throw new Error(`渲染輸出檔案過小（${fileBuf.length} bytes），可能渲染失敗`);
    }

    await setProgress(85);

    const storagePath = `${payload.userId}/${payload.projectId}/renders/${payload.renderJobId}.mp4`;
    await supabase.storage.from("courseflow-assets").upload(storagePath, fileBuf, {
      contentType: "video/mp4",
      upsert: true,
    });

    await jobs
      .update({ status: "completed", progress: 100, output_path: storagePath, error_message: null })
      .eq("id", payload.renderJobId);
    console.log(`[render] ${payload.renderJobId} 完成 → ${storagePath}`);
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[render] ${payload.renderJobId} 失敗:`, message);
    await failJob(message);
    throw e;
  } finally {
    if (workDir) {
      try {
        rmSync(workDir, { recursive: true, force: true });
        console.log(`[render] 已清理暫存目錄 ${workDir}`);
      } catch (cleanupErr) {
        console.warn(`[render] 無法清理暫存目錄 ${workDir}:`, cleanupErr);
      }
    }
  }
}
