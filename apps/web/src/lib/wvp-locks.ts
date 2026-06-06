import {
  DEFAULT_PHASE_LOCKS,
  DEFAULT_WVP_PHASE_LOCKS,
  normalizeWvpPhaseLocks,
  type PhaseLocks,
  type WvpPhaseLocks,
} from "@courseflow/core";

export function resolveWvpPhaseLocks(project: {
  wvp_phase_locks?: unknown;
  phase_locks?: unknown;
}): WvpPhaseLocks {
  const raw = project.wvp_phase_locks;
  // 只要存在 wvp_phase_locks 物件就優先採用，避免被 legacy phase_locks 汙染顯示狀態
  if (raw && typeof raw === "object") {
    return normalizeWvpPhaseLocks({
      ...DEFAULT_WVP_PHASE_LOCKS,
      ...(raw as WvpPhaseLocks),
    });
  }
  const pl = (project.phase_locks as PhaseLocks) ?? DEFAULT_PHASE_LOCKS;
  return normalizeWvpPhaseLocks({
    content: !!pl.content,
    checkpoint: false,
    craft: false,
    audio: !!pl.audio,
    publish: !!pl.visual,
  });
}

/** 鎖定 v1 階段時同步寫入 wvp_phase_locks */
/** 解析 lock API 回傳的 wvp_phase_locks；若為空則用 fallback（避免 UI 誤顯示未鎖定） */
export function parseWvpPhaseLocksResponse(
  raw: unknown,
  fallback?: WvpPhaseLocks,
): WvpPhaseLocks {
  if (raw && typeof raw === "object") {
    return normalizeWvpPhaseLocks({
      ...DEFAULT_WVP_PHASE_LOCKS,
      ...(raw as WvpPhaseLocks),
    });
  }
  return normalizeWvpPhaseLocks(fallback ?? DEFAULT_WVP_PHASE_LOCKS);
}

export function syncWvpLocksFromLegacyLock(
  wvp: WvpPhaseLocks,
  phase: "content" | "audio" | "visual",
  locked: boolean,
): WvpPhaseLocks {
  const next = { ...wvp };
  if (phase === "content") next.content = locked;
  if (phase === "audio") next.audio = locked;
  if (phase === "visual") {
    if (locked) next.publish = true;
    else next.publish = false;
  }
  return next;
}
