import {
  type WvpPhaseId,
  type WvpPhaseLocks,
  canAccessWvpPhase,
} from "./wvp-project.js";

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
  if (phase === "craft" && (!locks.content || !locks.checkpoint)) {
    return { ok: false, error: "請先鎖定內容與 Checkpoint" };
  }
  if (phase === "audio" && (!locks.content || !locks.checkpoint || !locks.craft)) {
    return { ok: false, error: "請先鎖定 Craft 階段" };
  }
  if (
    phase === "publish" &&
    (!locks.content || !locks.checkpoint || !locks.craft || !locks.audio)
  ) {
    return { ok: false, error: "請先鎖定音訊階段" };
  }
  return { ok: true, locks: { ...locks, [phase]: true } };
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
