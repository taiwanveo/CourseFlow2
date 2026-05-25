/** CourseFlow v2 — WVP 專案模型（真相源：presentation/ + narrations.ts） */

export type WvpCraftStatus =
  | "pending"
  | "generating"
  | "checklist-fail"
  | "anchor-review"
  | "approved";

export type WvpDevMode = "per-chapter" | "sequential" | "parallel";

export type WvpPhaseId = "content" | "checkpoint" | "craft" | "audio" | "publish";

export interface WvpPhaseLocks {
  content: boolean;
  checkpoint: boolean;
  craft: boolean;
  audio: boolean;
  publish: boolean;
}

export const DEFAULT_WVP_PHASE_LOCKS: WvpPhaseLocks = {
  content: false,
  checkpoint: false,
  craft: false,
  audio: false,
  publish: false,
};

export interface WvpChapterCraft {
  wvpId: string;
  title: string;
  craftStatus: WvpCraftStatus;
  stepCount: number;
  presentationPath?: string;
  lastChecklist?: {
    passed: boolean;
    checkedAt: string;
  };
}

export interface WvpProjectSources {
  articlePath: string;
  scriptPath: string;
  outlinePath: string;
}

export interface WvpProjectMeta {
  language: string;
  themeId: string | null;
  title: string;
  devMode: WvpDevMode;
  anchorChapterApproved: boolean;
}

export interface WvpProject {
  id: string;
  meta: WvpProjectMeta;
  sources: WvpProjectSources;
  presentation: {
    storageRevision: string | null;
    chapters: WvpChapterCraft[];
  };
  audio: {
    synthesizedAt: string | null;
    segmentsPath: string | null;
  };
  publish: {
    previewUrl: string | null;
    lastMp4Path: string | null;
  };
  phaseLocks: WvpPhaseLocks;
}

export const WVP_PHASE_ORDER: WvpPhaseId[] = [
  "content",
  "checkpoint",
  "craft",
  "audio",
  "publish",
];

export function canAccessWvpPhase(locks: WvpPhaseLocks, phase: WvpPhaseId): boolean {
  if (phase === "content") return true;
  if (phase === "checkpoint") return locks.content;
  if (phase === "craft") return locks.content && locks.checkpoint;
  if (phase === "audio") return locks.content && locks.checkpoint && locks.craft;
  if (phase === "publish") return locks.content && locks.checkpoint && locks.craft && locks.audio;
  return false;
}
