import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RENDER_TIMEOUT_MS = 600_000;

const require = createRequire(fileURLToPath(import.meta.url));

function resolveHyperframesCli(): string {
  return require.resolve("hyperframes/dist/cli.js");
}

function logHyperframesLine(line: string) {
  const trimmed = line.trim();
  if (trimmed) console.log(`[hyperframes] ${trimmed}`);
}

export async function runHyperFramesRender(
  workDir: string,
  options: {
    quality: "draft" | "standard" | "high";
    outputPath: string;
    estimatedDurationSec?: number;
    onProgress?: (progress: number) => void;
  },
): Promise<void> {
  const { quality, outputPath, estimatedDurationSec = 60, onProgress } = options;
  const cliPath = resolveHyperframesCli();
  const args = [
    cliPath,
    "render",
    "--quality",
    quality,
    "--output",
    outputPath,
    "--workers",
    "1",
  ];

  const renderFactor = quality === "draft" ? 1.5 : quality === "high" ? 4 : 3;
  const estimatedRenderMs = Math.max(60_000, estimatedDurationSec * 1000 * renderFactor);
  const renderStart = Date.now();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
    });

    let stderr = "";
    let stdout = "";
    let settled = false;
    let lastRealProgress = 40;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearInterval(progressTimer);
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve();
    };

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - renderStart;
      const ratio = Math.min(1, elapsed / estimatedRenderMs);
      const estimated = 40 + Math.round(ratio * 37);
      const next = Math.max(lastRealProgress, Math.min(77, estimated));
      lastRealProgress = next;
      onProgress?.(next);
    }, 5000);

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(
        new Error(
          `HyperFrames 渲染逾時（${Math.round(RENDER_TIMEOUT_MS / 60_000)} 分鐘）。最後輸出：${(stderr || stdout).slice(-500)}`,
        ),
      );
    }, RENDER_TIMEOUT_MS);

    const bumpFromOutput = (chunk: string) => {
      const percent = chunk.match(/(\d{1,3})\s*%/);
      if (percent) {
        const p = Number(percent[1]);
        if (p >= 0 && p <= 100) {
          lastRealProgress = 40 + Math.round(p * 0.38);
          onProgress?.(lastRealProgress);
          return;
        }
      }
      const frame = chunk.match(/frame\s+(\d+)\s*\/\s*(\d+)/i);
      if (frame) {
        const current = Number(frame[1]);
        const total = Number(frame[2]);
        if (total > 0) {
          lastRealProgress = 40 + Math.round((current / total) * 38);
          onProgress?.(lastRealProgress);
        }
      }
    };

    let fontMappingStallSince: number | null = null;

    const onChunk = (buf: Buffer, isErr: boolean) => {
      const text = buf.toString();
      if (isErr) stderr += text;
      else stdout += text;
      for (const line of text.split(/\r?\n/)) {
        logHyperframesLine(line);
      }
      if (/To fix, pick one:|No deterministic font mapping/i.test(text)) {
        fontMappingStallSince ??= Date.now();
        if (Date.now() - fontMappingStallSince > 120_000) {
          child.kill("SIGTERM");
          finish(
            new Error(
              "HyperFrames 字型解析逾時：匯出 HTML 仍含無法離線嵌入的字型。請重新編譯匯出（需最新 @courseflow/hf-bridge），或將文字/字幕字型改為 Roboto、Noto Sans 等內建選項。",
            ),
          );
          return;
        }
      } else if (/frame\s+\d+\s*\/\s*\d+/i.test(text)) {
        fontMappingStallSince = null;
      }
      bumpFromOutput(text);
    };

    child.stdout?.on("data", (buf) => onChunk(buf, false));
    child.stderr?.on("data", (buf) => onChunk(buf, true));

    child.on("error", (err) => {
      finish(
        new Error(
          `無法啟動 HyperFrames（${err.message}）。請執行：cd apps/worker && npx hyperframes doctor`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0 && existsSync(outputPath)) {
        onProgress?.(79);
        finish();
        return;
      }
      const detail = (stderr || stdout || `exit code ${code ?? "unknown"}`).trim();
      finish(new Error(`HyperFrames 渲染失敗：${detail.slice(0, 2000)}`));
    });
  });
}
