import { access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

function resolveMonorepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), "..", "..");
}

/** 本機 presentation 工作根目錄（每專案一個 presentation/ 子目錄） */
export function presentationsDataRoot(): string {
  const env = process.env.COURSEFLOW_PRESENTATION_ROOT?.trim();
  if (env) return env;
  return join(resolveMonorepoRoot(), "data", "presentations");
}

export function presentationDirForProject(projectId: string): string {
  return join(presentationsDataRoot(), projectId, "presentation");
}

export function presentationDistDir(projectId: string): string {
  return join(presentationDirForProject(projectId), "dist");
}

/** Vite build 的 base；由 wvp-embed 路由提供靜態檔 */
export function wvpEmbedBasePath(projectId: string): string {
  return `/projects/${projectId}/wvp-embed/`;
}

export function wvpPlayPagePath(projectId: string, auto?: boolean): string {
  const q = auto ? "?auto=1" : "";
  return `/projects/${projectId}/wvp-play${q}`;
}

export async function hasBuiltPresentation(projectId: string): Promise<boolean> {
  try {
    await access(join(presentationDistDir(projectId), "index.html"));
    return true;
  } catch {
    return false;
  }
}

export function isPresentationRevisionBuilt(revision: string | null | undefined): boolean {
  return typeof revision === "string" && revision.startsWith("built-");
}
