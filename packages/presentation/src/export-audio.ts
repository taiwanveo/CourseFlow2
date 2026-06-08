/**
 * WVP MP4 匯出音訊：Playwright 錄屏不含分頁音訊，需從 dist 內 MP3 組軌後與影片 mux。
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

export const EXPORT_AUDIO_MANIFEST = "cf-export-audio.json";

export interface ExportAudioStep {
  chapterId: string;
  step: number;
  /** dist 內相對路徑，例如 audio/ch-01/1.mp3 */
  audioRel: string | null;
  /** 無音檔時的 fallback 毫秒（與 App estimateMs 一致） */
  fallbackMs: number;
}

export interface ExportAudioManifest {
  trailMs: number;
  steps: ExportAudioStep[];
}

function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || out || `${cmd} exited ${code}`));
    });
    child.on("error", reject);
  });
}

function estimateMs(text: string): number {
  if (!text) return 1500;
  return Math.max(1500, text.length * 250);
}

function parseNarrationsFromTs(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*(.+),/);
    if (!m) continue;
    try {
      out.push(JSON.parse(m[1]!) as string);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** 從 presentation 原始碼建立匯出音訊清單（建置時寫入 dist） */
export async function buildExportAudioManifest(
  presentationDir: string,
): Promise<ExportAudioManifest> {
  const registryPath = join(presentationDir, "src", "registry", "chapters.ts");
  const registrySrc = await readFile(registryPath, "utf8");

  const chapterIds: string[] = [];
  for (const m of registrySrc.matchAll(/\bid:\s*"([^"]+)"/g)) {
    chapterIds.push(m[1]!);
  }

  const importFolders = [
    ...registrySrc.matchAll(/import\s+\w+\s+from\s+"\.\.\/chapters\/([^/]+)\//g),
  ].map((m) => m[1]!);
  const folderById = new Map<string, string>();
  chapterIds.forEach((id, i) => {
    const folder = importFolders[i];
    if (folder) folderById.set(id, folder);
  });

  const steps: ExportAudioStep[] = [];
  for (const chapterId of chapterIds) {
    const folder = folderById.get(chapterId);
    if (!folder) continue;
    const narrPath = join(presentationDir, "src", "chapters", folder, "narrations.ts");
    let narrations: string[] = [];
    try {
      narrations = parseNarrationsFromTs(await readFile(narrPath, "utf8"));
    } catch {
      narrations = [];
    }
    narrations.forEach((narration, step) => {
      const audioRel =
        narration.trim() === ""
          ? null
          : `audio/${chapterId}/${step + 1}.mp3`;
      steps.push({
        chapterId,
        step,
        audioRel,
        fallbackMs: estimateMs(narration),
      });
    });
  }

  return { trailMs: 200, steps };
}

export async function writeExportAudioManifest(
  presentationDir: string,
  distDir: string,
): Promise<void> {
  const manifest = await buildExportAudioManifest(presentationDir);
  await writeFile(
    join(distDir, EXPORT_AUDIO_MANIFEST),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

async function ensureSilenceMp3(workDir: string, ms: number): Promise<string> {
  const out = join(workDir, `silence-${ms}.mp3`);
  try {
    await access(out);
    return out;
  } catch {
    /* create */
  }
  const sec = Math.max(0.05, ms / 1000);
  await runCmd("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=2",
    "-t",
    String(sec),
    "-c:a",
    "libmp3lame",
    "-q:a",
    "9",
    out,
  ]);
  return out;
}

async function synthToneMp3(workDir: string, ms: number, tag: string): Promise<string> {
  const out = join(workDir, `fallback-${tag}.mp3`);
  const sec = Math.max(0.05, ms / 1000);
  await runCmd("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=2",
    "-t",
    String(sec),
    "-c:a",
    "libmp3lame",
    "-q:a",
    "9",
    out,
  ]);
  return out;
}

/** 從 dist 掃描音訊步驟（舊版 dist 無 manifest 時的後備） */
async function fallbackManifestFromDist(distDir: string): Promise<ExportAudioManifest> {
  const audioRoot = join(distDir, "audio");
  const steps: ExportAudioStep[] = [];
  try {
    const chapters = (await readdir(audioRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const chapterId of chapters) {
      const files = (await readdir(join(audioRoot, chapterId)))
        .filter((f) => f.endsWith(".mp3"))
        .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
      files.forEach((file, idx) => {
        steps.push({
          chapterId,
          step: idx,
          audioRel: `audio/${chapterId}/${file}`,
          fallbackMs: 1500,
        });
      });
    }
  } catch {
    /* empty */
  }
  return { trailMs: 200, steps };
}

async function loadManifest(distDir: string): Promise<ExportAudioManifest> {
  const manifestPath = join(distDir, EXPORT_AUDIO_MANIFEST);
  try {
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as ExportAudioManifest;
  } catch {
    return fallbackManifestFromDist(distDir);
  }
}

/**
 * 依 manifest 將各步 MP3（含步間 trail 靜音）合併成單一音軌。
 */
export async function buildCombinedExportAudio(
  distDir: string,
  workDir: string,
): Promise<string | null> {
  const manifest = await loadManifest(distDir);
  if (manifest.steps.length === 0) return null;

  await mkdir(workDir, { recursive: true });
  const trailSilence = await ensureSilenceMp3(workDir, manifest.trailMs);
  const listLines: string[] = [];
  let part = 0;

  for (let i = 0; i < manifest.steps.length; i++) {
    const step = manifest.steps[i]!;
    let segmentPath: string | null = null;

    if (step.audioRel) {
      const normalized = join(distDir, step.audioRel);
      try {
        await access(normalized);
        segmentPath = normalized;
      } catch {
        segmentPath = null;
      }
    }

    if (!segmentPath) {
      segmentPath = await synthToneMp3(
        workDir,
        step.fallbackMs,
        `${step.chapterId}-${step.step}`,
      );
    }

    const posix = segmentPath.replace(/\\/g, "/");
    listLines.push(`file '${posix.replace(/'/g, "'\\''")}'`);
    part++;

    if (i < manifest.steps.length - 1) {
      const trailPosix = trailSilence.replace(/\\/g, "/");
      listLines.push(`file '${trailPosix.replace(/'/g, "'\\''")}'`);
      part++;
    }
  }

  if (part === 0) return null;

  const listPath = join(workDir, "audio-concat.txt");
  const combinedPath = join(workDir, "combined-audio.mp3");
  await writeFile(listPath, listLines.join("\n"), "utf8");

  await runCmd("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    combinedPath,
  ]);

  return combinedPath;
}

/** 將音訊 mux 進影片（以較短者為準，避免尾端靜音過長） */
export async function muxAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await runCmd("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  ]);
}
