/**
 * 將已 build 完成的 WVP dist 錄製成 MP4。
 *
 * 這不是一般的檔案轉檔器，而是「把一份互動式前端簡報在瀏覽器中播放完，再把播放過程錄下來」。
 * 因此它的依賴不只是 ffmpeg，還包含：
 * - 可被載入的靜態站
 * - 能自動開始播放的前端狀態
 * - Playwright Chromium 錄屏
 * - 最後把 webm 轉成 mp4 的 ffmpeg
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import {
  buildCombinedExportAudio,
  muxAudioIntoVideo,
} from "./export-audio.js";
import { detectWvpEmbedPrefix, startStaticServer } from "./static-server.js";

/**
 * 執行外部命令並在失敗時帶出 stderr。
 *
 * 這裡主要服務 ffmpeg，刻意保留最小包裝，避免把錄製錯誤吞掉。
 */
function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr?.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exited ${code}`));
    });
    child.on("error", reject);
  });
}

/**
 * 將 Playwright 產出的 webm 轉成較通用的 mp4。
 *
 * 這不是強制成功的步驟；若 ffmpeg 不存在，呼叫端會得到 `false` 並決定如何報錯。
 */
async function convertWebmToMp4(webmPath: string, mp4Path: string): Promise<boolean> {
  try {
    await runCmd("ffmpeg", [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      mp4Path,
    ]);
    return true;
  } catch {
    return false;
  }
}

export interface RecordWvpOptions {
  distDir: string;
  outputPath: string;
  /** 最長等待簡報播完（毫秒） */
  maxDurationMs?: number;
  onProgress?: (pct: number) => void;
}

/**
 * 對已 build 的 WVP dist 啟動靜態站並執行瀏覽器錄屏。
 *
 * 成功條件不是「頁面能開」，而是：
 * 1. `#root` 成功載入。
 * 2. 自動播放有被啟動。
 * 3. 前端最終把 `document.documentElement.dataset.cfPresentationDone` 設成 `1`。
 * 4. Playwright 真的產生錄屏檔。
 * 5. 錄屏檔可被轉成 mp4。
 */
export async function recordWvpPresentation(opts: RecordWvpOptions): Promise<void> {
  const maxMs = opts.maxDurationMs ?? 45 * 60 * 1000;
  const videosDir = join(dirname(opts.outputPath), "pw-videos");
  await mkdir(videosDir, { recursive: true });

  const embedPrefix = await detectWvpEmbedPrefix(opts.distDir);
  const { port, close: closeServer } = await startStaticServer(opts.distDir, 0, {
    pathPrefix: embedPrefix,
  });
  const url = `http://127.0.0.1:${port}/?auto=1&recording=1&export=1`;

  opts.onProgress?.(45);

  // 固定輸出 1920x1080，確保預覽與最終影片尺寸一致，避免播放器自動縮放造成畫面差異。
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: videosDir, size: { width: 1920, height: 1080 } },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(maxMs);
  let progressHeartbeat: ReturnType<typeof setInterval> | null = null;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    opts.onProgress?.(50);
    await page.waitForSelector("#root", { state: "attached", timeout: 30_000 });
    await page.waitForTimeout(500);

    // export=1 應跳過 overlay；舊版 dist 仍可能顯示 gate，需先解除再錄製。
    const gate = page.locator(".auto-gate");
    if (await gate.isVisible().catch(() => false)) {
      await gate.click();
      await page.waitForSelector(".auto-gate", { state: "hidden", timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    opts.onProgress?.(55);

    let playbackPct = 55;
    progressHeartbeat = setInterval(() => {
      playbackPct = Math.min(79, playbackPct + 1);
      opts.onProgress?.(playbackPct);
    }, 20_000);

    try {
      await page.waitForFunction(
        () => document.documentElement.dataset.cfPresentationDone === "1",
        undefined,
        { timeout: maxMs, polling: 500 },
      );
    } catch (e) {
      const hint = await page
        .evaluate(() => ({
          done: document.documentElement.dataset.cfPresentationDone,
          hasRoot: !!document.querySelector("#root")?.childElementCount,
          gate: !!document.querySelector(".auto-gate"),
        }))
        .catch(() => null);
      if (hint && !hint.hasRoot) {
        throw new Error(
          "簡報未正確載入（JS/CSS 404）。請重新「打包課程預覽」後再匯出 MP4。",
          { cause: e },
        );
      }
      if (hint?.gate) {
        throw new Error(
          "自動播放未啟動：請確認 dist 完整且可從本機靜態站載入。",
          { cause: e },
        );
      }
      throw new Error(
        `錄製逾時（${Math.round(maxMs / 60000)} 分鐘內未播完）。口播較長時屬正常，可稍後重試或縮短文稿。`,
        { cause: e },
      );
    }
    if (progressHeartbeat) clearInterval(progressHeartbeat);
    opts.onProgress?.(80);
  } finally {
    if (progressHeartbeat) clearInterval(progressHeartbeat);
    const pageVideo = page.video();
    await page.close();
    await context.close();
    await browser.close();
    await closeServer();

    // Playwright 理論上會提供 page.video().path()；若沒有，就退回直接掃錄影目錄。
    let webmPath: string | null = null;
    if (pageVideo) {
      webmPath = await pageVideo.path();
    }
    if (!webmPath) {
      const entries = await readdir(videosDir);
      const webm = entries.find((e) => e.endsWith(".webm"));
      if (webm) webmPath = join(videosDir, webm);
    }
    if (!webmPath) throw new Error("Playwright 未產生錄屏檔");

    opts.onProgress?.(82);
    const videoOnlyPath = join(dirname(opts.outputPath), "video-only.mp4");
    const converted = await convertWebmToMp4(webmPath, videoOnlyPath);
    if (!converted) {
      const buf = await readFile(webmPath);
      if (webmPath.endsWith(".webm")) {
        throw new Error(
          "錄屏完成但無法轉成 MP4：請安裝 ffmpeg 並加入 PATH，或手動轉檔 webm。",
        );
      }
      await writeFile(videoOnlyPath, buf);
    }

    opts.onProgress?.(84);
    const audioWorkDir = join(dirname(opts.outputPath), "export-audio");
    const combinedAudio = await buildCombinedExportAudio(opts.distDir, audioWorkDir);
    if (combinedAudio) {
      opts.onProgress?.(86);
      await muxAudioIntoVideo(videoOnlyPath, combinedAudio, opts.outputPath);
      await rm(audioWorkDir, { recursive: true, force: true }).catch(() => undefined);
      await rm(videoOnlyPath, { force: true }).catch(() => undefined);
    } else {
      await writeFile(opts.outputPath, await readFile(videoOnlyPath));
      await rm(videoOnlyPath, { force: true }).catch(() => undefined);
    }

    await rm(videosDir, { recursive: true, force: true });
  }
}
