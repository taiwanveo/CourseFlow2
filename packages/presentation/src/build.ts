import { access, mkdir } from "node:fs/promises";
import { writeDistManifest } from "./dist-storage.js";
import { repairPresentationBeforeBuild } from "./repair-presentation.js";
import { repairPresentationChapterImports } from "./write-sources.js";
import { spawn } from "node:child_process";
import { join } from "node:path";

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
  };
}

async function presentationHasVite(presentationDir: string): Promise<boolean> {
  try {
    await access(join(presentationDir, "node_modules", "vite", "package.json"));
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
  if (await presentationHasVite(presentationDir)) return;
  await run(
    "npm",
    ["install", "--no-audit", "--no-fund", "--include=dev"],
    presentationDir,
    npmInstallEnv(baseEnv),
  );
  if (!(await presentationHasVite(presentationDir))) {
    throw new Error("npm install 完成後仍找不到 vite，請檢查 presentation/package.json");
  }
}

function run(cmd: string, args: string[], cwd: string, env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
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
  const npmEnv = await npmChildEnv(presentationDir);
  await ensurePresentationDependencies(presentationDir, npmEnv, options.skipInstall);

  const base = options.previewBase.endsWith("/")
    ? options.previewBase
    : `${options.previewBase}/`;

  const repair = await repairPresentationBeforeBuild(presentationDir);
  await repairPresentationChapterImports(presentationDir);

  const heapMb = process.env.COURSEFLOW_VITE_HEAP_MB?.trim() || "384";
  await run(
    "npm",
    ["run", "build"],
    presentationDir,
    {
      ...npmInstallEnv(npmEnv),
      NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
      CF_STUDIO_PREVIEW_BASE: base,
      VITE_CF_STUDIO_PREVIEW: "true",
      VITE_CF_HIDE_NARRATION: "true",
    },
  );

  const distDir = join(presentationDir, "dist");
  const indexHtml = join(distDir, "index.html");
  await access(indexHtml);
  await writeDistManifest(distDir);
  return {
    distDir,
    indexHtml,
    chaptersVisualUpgraded: repair.chaptersUpgraded,
  };
}
