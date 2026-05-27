import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { detectWvpEmbedPrefix, startStaticServer } from "./static-server.js";

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
 * 對已 build 的 WVP dist 啟動靜態站 + Playwright ?auto=1 錄屏。
 */
export async function recordWvpPresentation(opts: RecordWvpOptions): Promise<void> {
  const maxMs = opts.maxDurationMs ?? 45 * 60 * 1000;
  const videosDir = join(dirname(opts.outputPath), "pw-videos");
  await mkdir(videosDir, { recursive: true });

  const embedPrefix = await detectWvpEmbedPrefix(opts.distDir);
  const { port, close: closeServer } = await startStaticServer(opts.distDir, 0, {
    pathPrefix: embedPrefix,
  });
  const url = `http://127.0.0.1:${port}/?auto=1`;

  opts.onProgress?.(45);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: videosDir, size: { width: 1920, height: 1080 } },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(maxMs);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    opts.onProgress?.(50);
    await page.waitForSelector("#root", { state: "attached", timeout: 30_000 });
    await page.waitForTimeout(500);

    const gate = page.locator(".auto-gate");
    if (await gate.isVisible().catch(() => false)) {
      await gate.click();
    } else {
      await page.keyboard.press("Space");
    }
    opts.onProgress?.(55);

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
    opts.onProgress?.(80);
  } finally {
    const pageVideo = page.video();
    await page.close();
    await context.close();
    await browser.close();
    await closeServer();

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

    const converted = await convertWebmToMp4(webmPath, opts.outputPath);
    if (!converted) {
      const buf = await readFile(webmPath);
      if (webmPath.endsWith(".webm")) {
        throw new Error(
          "錄屏完成但無法轉成 MP4：請安裝 ffmpeg 並加入 PATH，或手動轉檔 webm。",
        );
      }
      await writeFile(opts.outputPath, buf);
    }

    await rm(videosDir, { recursive: true, force: true });
  }
}
