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

/** 使用者可見的四階段（不含已併入文稿／視覺動效的 checkpoint） */
export const WVP_PHASE_ORDER: WvpPhaseId[] = ["content", "craft", "audio", "publish"];

export function canAccessWvpPhase(locks: WvpPhaseLocks, phase: WvpPhaseId): boolean {
  if (phase === "content") return true;
  if (phase === "checkpoint") return false;
  if (phase === "craft") return locks.content;
  if (phase === "audio") return locks.content && locks.craft;
  if (phase === "publish") return locks.content && locks.craft && locks.audio;
  return false;
}

/** 導覽列無法進入某階段時，顯示給使用者的說明（繁中） */
export function wvpPhaseAccessBlockedReason(
  locks: WvpPhaseLocks,
  phase: WvpPhaseId,
): string | null {
  if (canAccessWvpPhase(locks, phase)) return null;
  if (phase === "checkpoint") return "此階段已併入文稿與視覺動效";
  if (phase === "craft") {
    if (!locks.content) return "請先鎖定「1. 文稿內容」";
  }
  if (phase === "audio") return "請先完成並鎖定「2. 視覺動效」";
  if (phase === "publish") return "請先完成並鎖定「3. 語音生成」";
  return "請先完成前一階段";
}
