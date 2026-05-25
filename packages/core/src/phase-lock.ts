export type PhaseId = "content" | "audio" | "visual";

export const PHASE_ORDER: PhaseId[] = ["content", "audio", "visual"];

export interface PhaseLocks {
  content: boolean;
  audio: boolean;
  visual: boolean;
}

export const DEFAULT_PHASE_LOCKS: PhaseLocks = {
  content: false,
  audio: false,
  visual: false,
};

export function canAccessPhase(locks: PhaseLocks, phase: PhaseId): boolean {
  if (phase === "content") return true;
  if (phase === "audio") return locks.content;
  if (phase === "visual") return locks.content && locks.audio;
  return false;
}

export function canEditPhase(locks: PhaseLocks, phase: PhaseId): boolean {
  if (locks[phase]) return false;
  return canAccessPhase(locks, phase);
}

/** Lock a phase; returns updated locks or error message. */
export function lockPhase(
  locks: PhaseLocks,
  phase: PhaseId,
): { ok: true; locks: PhaseLocks } | { ok: false; error: string } {
  if (locks[phase]) {
    return { ok: false, error: `階段 ${phase} 已鎖定` };
  }
  if (phase === "audio" && !locks.content) {
    return { ok: false, error: "請先鎖定階段 1（文稿內容）" };
  }
  if (phase === "visual" && (!locks.content || !locks.audio)) {
    return { ok: false, error: "請先鎖定階段 1 與階段 2" };
  }
  return { ok: true, locks: { ...locks, [phase]: true } };
}

/**
 * Unlock a phase with cascade rules:
 * - unlock content → also unlock audio + visual
 * - unlock audio → also unlock visual
 * - unlock visual → only visual
 */
export function unlockPhase(locks: PhaseLocks, phase: PhaseId): PhaseLocks {
  const next = { ...locks, [phase]: false };
  if (phase === "content") {
    next.audio = false;
    next.visual = false;
  } else if (phase === "audio") {
    next.visual = false;
  }
  return next;
}

export function assertPhaseEditable(
  locks: PhaseLocks,
  phase: PhaseId,
): void {
  if (!canEditPhase(locks, phase)) {
    if (locks[phase]) {
      throw new PhaseLockedError(phase, "此階段已鎖定，請先解除鎖定");
    }
    throw new PhaseLockedError(phase, "請先完成並鎖定前一階段");
  }
}

export class PhaseLockedError extends Error {
  constructor(
    public readonly phase: PhaseId,
    message: string,
  ) {
    super(message);
    this.name = "PhaseLockedError";
  }
}
