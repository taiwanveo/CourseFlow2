import { access } from "node:fs/promises";
import { writeDistManifest } from "./dist-storage.js";
import { repairPresentationBeforeBuild } from "./repair-presentation.js";
import { repairPresentationChapterImports } from "./write-sources.js";
import { spawn } from "node:child_process";
import { join } from "node:path";

function run(cmd: string, args: string[], cwd: string, env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
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
  const nodeModules = join(presentationDir, "node_modules");
  try {
    await access(nodeModules);
  } catch {
    if (!options.skipInstall) {
      await run("npm", ["install", "--no-audit", "--no-fund"], presentationDir, {});
    }
  }

  const base = options.previewBase.endsWith("/")
    ? options.previewBase
    : `${options.previewBase}/`;

  const repair = await repairPresentationBeforeBuild(presentationDir);
  await repairPresentationChapterImports(presentationDir);

  await run(
    "npm",
    ["run", "build"],
    presentationDir,
    {
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
