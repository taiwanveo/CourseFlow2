import { access, appendFile, mkdir } from "node:fs/promises";
import { writeDistManifest } from "./dist-storage.js";
import { repairPresentationBeforeBuild } from "./repair-presentation.js";
import { repairPresentationChapterImports } from "./write-sources.js";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

// #region agent log
const DEBUG_LOG = join(process.cwd(), "debug-9d8c4f.log");
function wvpBuildDebug(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const line = `${JSON.stringify({
    sessionId: "9d8c4f",
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId: data.runId ?? "pre-fix",
  })}\n`;
  void appendFile(DEBUG_LOG, line).catch(() => {});
}
// #endregion

/** Debian 系統使用者的 HOME 常為 /nonexistent，npm 無法寫入 cache／log */
const INVALID_HOME = new Set(["", "/nonexistent"]);

function presentationsDataRoot(presentationDir: string): string {
  const env = process.env.COURSEFLOW_PRESENTATION_ROOT?.trim();
  if (env) return env;
  return join(presentationDir, "..", "..");
}

/** 子程序執行 npm 時的可寫入 HOME 與 cache（Render nextjs 使用者必備） */
async function npmChildEnv(presentationDir: string): Promise<Record<string, string>> {
  const root = presentationsDataRoot(presentationDir);
  const rawHome = process.env.HOME?.trim() ?? "";
  const homeDir = INVALID_HOME.has(rawHome) ? join(root, ".npm-home") : rawHome;
  const cacheDir = process.env.NPM_CONFIG_CACHE?.trim() || join(root, ".npm-cache");
  await mkdir(homeDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  return { HOME: homeDir, NPM_CONFIG_CACHE: cacheDir };
}

/**
 * Web 容器常設 NODE_ENV=production，npm 會略過 devDependencies（含 vite）。
 * 建置 presentation 時必須安裝完整依賴。
 */
function npmInstallEnv(base: Record<string, string>): Record<string, string> {
  return {
    ...base,
    NODE_ENV: "development",
    npm_config_production: "false",
    NPM_CONFIG_PRODUCTION: "false",
    npm_config_omit: "",
    NPM_CONFIG_OMIT: "",
  };
}

function viteCliPath(presentationDir: string): string {
  return resolve(presentationDir, "node_modules", "vite", "bin", "vite.js");
}

async function presentationDepsReady(presentationDir: string): Promise<boolean> {
  try {
    await access(join(presentationDir, "node_modules", "vite", "package.json"));
    await access(viteCliPath(presentationDir));
    await access(join(presentationDir, "node_modules", "framer-motion", "package.json"));
    return true;
  } catch {
    return false;
  }
}

async function ensurePresentationDependencies(
  presentationDir: string,
  baseEnv: Record<string, string>,
  skipInstall?: boolean,
): Promise<void> {
  if (skipInstall) return;
  if (await presentationDepsReady(presentationDir)) return;
  await run(
    "npm",
    ["install", "--no-audit", "--no-fund", "--include=dev"],
    presentationDir,
    npmInstallEnv(baseEnv),
  );
  if (!(await presentationDepsReady(presentationDir))) {
    throw new Error("npm install 完成後仍找不到 vite，請檢查 presentation/package.json");
  }
}

interface RunOptions {
  /** Windows 上含空格的 node.exe 路徑必須 shell:false，否則會被截成 C:\Program */
  shell?: boolean;
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  options?: RunOptions,
): Promise<void> {
  const shell = options?.shell ?? process.platform === "win32";
  return new Promise((resolve, reject) => {
    // #region agent log
    wvpBuildDebug("build.ts:run", "spawn", { cmd, args, cwd, shell }, "C");
    // #endregion
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const tail = (err || out).slice(-4000);
        console.error(`[wvp-build] ${cmd} ${args.join(" ")} failed:\n${tail}`);
        reject(new Error(tail || `${cmd} exited ${code}`));
      }
    });
    child.on("error", reject);
  });
}

export interface BuildPresentationOptions {
  /** Vite base，例如 /projects/<id>/wvp-play/ */
  previewBase: string;
  skipInstall?: boolean;
  /** 0–100 編譯進度；label 為目前子步驟說明 */
  onProgress?: (pct: number, label?: string) => void;
}

export interface BuildPresentationResult {
  distDir: string;
  indexHtml: string;
  chaptersVisualUpgraded?: string[];
}

export async function buildPresentation(
  presentationDir: string,
  options: BuildPresentationOptions,
): Promise<BuildPresentationResult> {
  presentationDir = resolve(presentationDir);
  const report = (pct: number, label?: string) => {
    options.onProgress?.(pct, label);
  };

  report(0, "檢查依賴");
  const npmEnv = await npmChildEnv(presentationDir);
  await ensurePresentationDependencies(presentationDir, npmEnv, options.skipInstall);

  const base = options.previewBase.endsWith("/")
    ? options.previewBase
    : `${options.previewBase}/`;

  report(8, "修復章節來源");
  const repair = await repairPresentationBeforeBuild(presentationDir);
  await repairPresentationChapterImports(presentationDir);

  const heapMb = process.env.COURSEFLOW_VITE_HEAP_MB?.trim() || "384";
  report(12, "Vite 編譯中");
  const viteStartedAt = Date.now();
  const viteHeartbeat = setInterval(() => {
    const elapsedSec = (Date.now() - viteStartedAt) / 1000;
    const creep = Math.min(88, 12 + Math.floor(elapsedSec * 1.2));
    report(creep, "Vite 編譯中");
  }, 3000);

  const viteCli = viteCliPath(presentationDir);
  const hasVite = await presentationDepsReady(presentationDir);
  // #region agent log
  wvpBuildDebug(
    "build.ts:buildPresentation",
    "vite-build-start",
    {
      presentationDir,
      viteCli,
      nodeExecPath: process.execPath,
      hasVite,
      skipInstall: options.skipInstall ?? false,
      nodeEnv: process.env.NODE_ENV ?? "",
      npmConfigProduction: process.env.npm_config_production ?? "",
    },
    "A",
  );
  // #endregion
  try {
    // 直接 node vite.js，避免 Windows 上 npm run build 找不到 .bin/vite
    await run(
      process.execPath,
      [viteCli, "build"],
      presentationDir,
      {
        ...npmInstallEnv(npmEnv),
        NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
        CF_STUDIO_PREVIEW_BASE: base,
        VITE_CF_STUDIO_PREVIEW: "true",
        VITE_CF_HIDE_NARRATION: "true",
      },
      { shell: false },
    );
    // #region agent log
    wvpBuildDebug(
      "build.ts:buildPresentation",
      "vite-build-done",
      { presentationDir, elapsedMs: Date.now() - viteStartedAt, runId: "post-fix" },
      "C",
    );
    // #endregion
  } finally {
    clearInterval(viteHeartbeat);
  }

  report(92, "驗證建置結果");
  const distDir = join(presentationDir, "dist");
  const indexHtml = join(distDir, "index.html");
  await access(indexHtml);
  report(96, "寫入清單");
  await writeDistManifest(distDir);
  report(100, "編譯完成");
  return {
    distDir,
    indexHtml,
    chaptersVisualUpgraded: repair.chaptersUpgraded,
  };
}
