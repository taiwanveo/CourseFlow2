import {
  WVP_PHASE_ORDER,
  type WvpPhaseId,
  type WvpPhaseLocks,
  canAccessWvpPhase,
} from "./wvp-project.js";

/** 修正不一致的鎖定狀態；checkpoint 欄位僅相容舊資料（content 鎖定時視為已通過） */
export function normalizeWvpPhaseLocks(locks: WvpPhaseLocks): WvpPhaseLocks {
  const n = { ...locks };
  if (!n.content) {
    n.checkpoint = false;
    n.craft = false;
    n.audio = false;
    n.publish = false;
  } else {
    n.checkpoint = true;
    if (!n.craft) {
      n.audio = false;
      n.publish = false;
    } else if (!n.audio) {
      n.publish = false;
    }
  }
  return n;
}

export function canEditWvpPhase(locks: WvpPhaseLocks, phase: WvpPhaseId): boolean {
  if (locks[phase]) return false;
  return canAccessWvpPhase(locks, phase);
}

export function lockWvpPhase(
  locks: WvpPhaseLocks,
  phase: WvpPhaseId,
): { ok: true; locks: WvpPhaseLocks } | { ok: false; error: string } {
  if (locks[phase]) {
    return { ok: false, error: `階段 ${phase} 已鎖定` };
  }
  if (phase === "checkpoint" && !locks.content) {
    return { ok: false, error: "請先鎖定內容階段" };
  }
  if (phase === "craft" && !locks.content) {
    return { ok: false, error: "請先鎖定文稿內容" };
  }
  if (phase === "audio" && (!locks.content || !locks.craft)) {
    return { ok: false, error: "請先鎖定視覺動效" };
  }
  if (phase === "publish" && (!locks.content || !locks.craft || !locks.audio)) {
    return { ok: false, error: "請先鎖定語音生成" };
  }
  const next: WvpPhaseLocks = { ...locks, [phase]: true };
  if (phase === "content") next.checkpoint = true;
  return { ok: true, locks: next };
}

/** 四個使用者可見階段是否皆已鎖定 */
export function allWvpPhasesLocked(locks: WvpPhaseLocks): boolean {
  return WVP_PHASE_ORDER.every((phase) => locks[phase]);
}

/** 依序鎖定 content → craft → audio → publish（略過已鎖定者） */
export function lockAllWvpPhases(
  locks: WvpPhaseLocks,
): { ok: true; locks: WvpPhaseLocks } | { ok: false; error: string; phase?: WvpPhaseId } {
  let next = { ...locks };
  for (const phase of WVP_PHASE_ORDER) {
    if (next[phase]) continue;
    const result = lockWvpPhase(next, phase);
    if (!result.ok) {
      return { ok: false, error: result.error, phase };
    }
    next = result.locks;
  }
  return { ok: true, locks: normalizeWvpPhaseLocks(next) };
}

export function unlockWvpPhase(locks: WvpPhaseLocks, phase: WvpPhaseId): WvpPhaseLocks {
  const next = { ...locks, [phase]: false };
  if (phase === "content") {
    next.checkpoint = false;
    next.craft = false;
    next.audio = false;
    next.publish = false;
  } else if (phase === "checkpoint") {
    next.craft = false;
    next.audio = false;
    next.publish = false;
  } else if (phase === "craft") {
    next.audio = false;
    next.publish = false;
  } else if (phase === "audio") {
    next.publish = false;
  }
  return next;
}

export class WvpPhaseLockedError extends Error {
  constructor(
    public readonly phase: WvpPhaseId,
    message: string,
  ) {
    super(message);
    this.name = "WvpPhaseLockedError";
  }
}

export function assertWvpPhaseEditable(locks: WvpPhaseLocks, phase: WvpPhaseId): void {
  if (!canEditWvpPhase(locks, phase)) {
    if (locks[phase]) {
      throw new WvpPhaseLockedError(phase, "此階段已鎖定，請先解除鎖定");
    }
    throw new WvpPhaseLockedError(phase, "請先完成並鎖定前一階段");
  }
}
