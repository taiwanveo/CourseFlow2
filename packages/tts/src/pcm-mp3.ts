import { spawn } from "node:child_process";

/** OpenRouter／Gemini TTS 的 PCM 預設：24kHz、16-bit、mono */
export const GEMINI_TTS_PCM_SAMPLE_RATE = 24_000;
export const GEMINI_TTS_PCM_CHANNELS = 1;

export function isGeminiOpenRouterTtsModel(model: string): boolean {
  return /gemini.*tts|tts.*gemini/i.test(model);
}

export function openRouterSpeechResponseFormat(model: string): "pcm" | "mp3" {
  return isGeminiOpenRouterTtsModel(model) ? "pcm" : "mp3";
}

/** 將 s16le PCM 透過 ffmpeg 轉成 MP3（CourseFlow 儲存與播放器皆預期 MP3） */
export async function transcodePcm16ToMp3(
  pcm: Buffer,
  sampleRate = GEMINI_TTS_PCM_SAMPLE_RATE,
  channels = GEMINI_TTS_PCM_CHANNELS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const proc = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "s16le",
        "-ar",
        String(sampleRate),
        "-ac",
        String(channels),
        "-i",
        "pipe:0",
        "-f",
        "mp3",
        "-q:a",
        "2",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    proc.stdout.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });
    proc.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk as Buffer);
    });
    proc.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(
          new Error(
            "Gemini TTS 回傳 PCM，需 ffmpeg 轉成 MP3，但伺服器未安裝 ffmpeg",
          ),
        );
        return;
      }
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      const detail = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          `PCM 轉 MP3 失敗${detail ? `：${detail.slice(0, 200)}` : ""}`,
        ),
      );
    });

    proc.stdin.write(pcm);
    proc.stdin.end();
  });
}
