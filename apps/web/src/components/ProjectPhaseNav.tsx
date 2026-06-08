"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  allWvpPhasesLocked,
  canAccessWvpPhase,
  canEditWvpPhase,
  lockAllWvpPhases,
  lockWvpPhase,
  wvpPhaseAccessBlockedReason,
  type WvpPhaseId,
  type WvpPhaseLocks,
} from "@courseflow/core";
import { cn } from "@/lib/cn";
import { parseWvpPhaseLocksResponse } from "@/lib/wvp-locks";
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { useToast } from "@/components/Toast";

const PHASES: { id: WvpPhaseId; label: string; href: (id: string) => string }[] = [
  { id: "content", label: "1. 文稿內容", href: (id) => `/projects/${id}/content` },
  { id: "craft", label: "2. 視覺動效", href: (id) => `/projects/${id}/craft` },
  { id: "audio", label: "3. 語音生成", href: (id) => `/projects/${id}/audio` },
  { id: "publish", label: "4. 預覽匯出", href: (id) => `/projects/${id}/publish` },
];

const NEXT_PHASE: Partial<Record<WvpPhaseId, { id: WvpPhaseId; label: string }>> = {
  content: { id: "craft", label: "2. 視覺動效" },
  craft: { id: "audio", label: "3. 語音生成" },
  audio: { id: "publish", label: "4. 預覽匯出" },
};

export type WvpPhaseNavCurrent = WvpPhaseId | "play";

/** v2 五階段導覽（外觀沿用 v1 cf-btn 樣式） */
export function WvpPhaseNav({
  projectId,
  current,
  locks,
  onLocksChange,
  onBeforeLock,
}: {
  projectId: string;
  current: WvpPhaseNavCurrent;
  locks: WvpPhaseLocks;
  onLocksChange: (locks: WvpPhaseLocks) => void;
  onBeforeLock?: () => Promise<void>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isPlayPage = current === "play";
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const lockPhase = async (phase: WvpPhaseId) => {
    setPendingAction(`lock-${phase}`);
    const priorLocks = locks;
    const optimistic = lockWvpPhase(priorLocks, phase);
    try {
      if (optimistic.ok) {
        onLocksChange(optimistic.locks);
      }
      if (!isPlayPage && phase === current && onBeforeLock) {
        await onBeforeLock();
      }
      const res = await fetch(`/api/projects/${projectId}/wvp/phases/${phase}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      });
      const data = (await res.json()) as { error?: string; wvp_phase_locks?: unknown };
      if (!res.ok) {
        onLocksChange(priorLocks);
        toast(data.error ?? "鎖定失敗", "error");
        return;
      }
      onLocksChange(
        parseWvpPhaseLocksResponse(
          data.wvp_phase_locks,
          optimistic.ok ? optimistic.locks : priorLocks,
        ),
      );
      router.refresh();
      const n = PHASES.find((p) => p.id === phase)?.label ?? phase;
      toast(`${n} 已鎖定`, "success");
    } catch {
      onLocksChange(priorLocks);
      toast("鎖定失敗", "error");
    } finally {
      setPendingAction(null);
    }
  };

  const lockAllPhases = async () => {
    setPendingAction("lock-all");
    const priorLocks = locks;
    const optimistic = lockAllWvpPhases(priorLocks);
    try {
      if (
        !isPlayPage &&
        current !== "play" &&
        typeof current === "string" &&
        !locks[current] &&
        onBeforeLock
      ) {
        await onBeforeLock();
      }
      if (optimistic.ok) {
        onLocksChange(optimistic.locks);
      }
      const res = await fetch(`/api/projects/${projectId}/wvp/phases/lock-all`, {
        method: "PATCH",
      });
      const data = (await res.json()) as { error?: string; wvp_phase_locks?: unknown };
      if (!res.ok) {
        onLocksChange(priorLocks);
        toast(data.error ?? "鎖定全部階段失敗", "error");
        return;
      }
      onLocksChange(
        parseWvpPhaseLocksResponse(
          data.wvp_phase_locks,
          optimistic.ok ? optimistic.locks : priorLocks,
        ),
      );
      router.refresh();
      toast("已鎖定全部階段", "success");
    } catch {
      onLocksChange(priorLocks);
      toast("鎖定全部階段失敗", "error");
    } finally {
      setPendingAction(null);
    }
  };

  const unlockPhase = async (phase: WvpPhaseId) => {
    setPendingAction(`unlock-${phase}`);
    try {
    const res = await fetch(`/api/projects/${projectId}/wvp/phases/${phase}/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "解除鎖定失敗", "error");
      return;
    }
    onLocksChange(parseWvpPhaseLocksResponse(data.wvp_phase_locks, locks));
    router.refresh();
    toast("已解除鎖定", "info");
    } finally {
      setPendingAction(null);
    }
  };

  const showLockAll = !allWvpPhasesLocked(locks);

  return (
    <nav className="mb-6 border-b border-[var(--border)] pb-4">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        {PHASES.map((p) => {
          const accessible = canAccessWvpPhase(locks, p.id);
          const blockedReason = wvpPhaseAccessBlockedReason(locks, p.id);
          const active = p.id === current;
          const isLocked = locks[p.id];
          const showLock =
            !isLocked && p.id === current && !isPlayPage && canEditWvpPhase(locks, p.id);

          return (
            <div key={p.id} className="flex min-w-[7.5rem] flex-col gap-1.5">
              <Link
                href={accessible ? p.href(projectId) : "#"}
                title={blockedReason ?? undefined}
                className={cn(
                  "cf-btn cf-btn-sm w-full justify-center text-xs",
                  active && "cf-btn-primary",
                  !active && accessible && "cf-btn-secondary",
                  !accessible && "pointer-events-none opacity-40",
                )}
                aria-disabled={!accessible}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (!accessible) {
                    e.preventDefault();
                    if (blockedReason) toast(blockedReason, "info");
                  }
                }}
              >
                {p.label}
                {isLocked ? " · 鎖" : ""}
              </Link>
              <div className="flex min-h-[30px] items-center justify-center">
                {isLocked ? (
                  <button
                    type="button"
                    onClick={() => unlockPhase(p.id)}
                    disabled={pendingAction === `unlock-${p.id}`}
                    className={cn(
                      "w-full rounded border border-amber-600/80 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-950/40 disabled:cursor-wait",
                      pendingAction === `unlock-${p.id}` && "animate-pulse",
                    )}
                  >
                    {pendingAction === `unlock-${p.id}` ? "處理中…" : "解除鎖定"}
                  </button>
                ) : showLock ? (
                  <button
                    type="button"
                    onClick={() => lockPhase(p.id)}
                    disabled={pendingAction === `lock-${p.id}`}
                    className={cn(
                      "w-full rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-black hover:opacity-90 disabled:cursor-wait",
                      pendingAction === `lock-${p.id}` && "animate-pulse opacity-70",
                    )}
                  >
                    {pendingAction === `lock-${p.id}` ? "處理中…" : "鎖定"}
                  </button>
                ) : (
                  <span className="invisible px-2 py-1 text-[11px]" aria-hidden>
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {showLockAll ? (
          <div className="flex min-w-[7.5rem] flex-col gap-1.5 self-start sm:ml-auto">
            <button
              type="button"
              onClick={lockAllPhases}
              disabled={pendingAction === "lock-all"}
              title="依序鎖定文稿、視覺動效、語音生成與預覽匯出"
              className={cn(
                "cf-btn cf-btn-sm w-full justify-center border border-lime-600/70 bg-lime-950/30 text-xs text-lime-300 hover:bg-lime-950/50 disabled:cursor-wait",
                pendingAction === "lock-all" && "animate-pulse opacity-70",
              )}
            >
              {pendingAction === "lock-all" ? "鎖定中…" : "鎖定全部階段"}
            </button>
            <div className="min-h-[30px]" aria-hidden />
          </div>
        ) : null}
        {locks.publish ? (
          <div className="flex flex-col gap-1.5 self-start">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/projects/${projectId}/play`}
                className={cn(
                  "cf-btn cf-btn-sm",
                  current === "play" ? "cf-btn-primary" : "cf-btn-secondary",
                )}
              >
                播放
              </Link>
              <ExportMp4Button projectId={projectId} />
            </div>
            <div className="min-h-[30px]" aria-hidden />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export function WvpPhaseBottomActions({
  projectId,
  phase,
  locks,
  saving,
  onSave,
  onUnlock,
}: {
  projectId: string;
  phase: WvpPhaseId;
  locks: WvpPhaseLocks;
  saving?: boolean;
  onSave?: () => void;
  onUnlock: () => void | Promise<void>;
}) {
  const locked = locks[phase];
  const next = NEXT_PHASE[phase];
  const [unlocking, setUnlocking] = useState(false);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await onUnlock();
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!locked && onSave ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="cf-btn cf-btn-secondary disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
      ) : null}
      {locked ? (
        <>
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking}
            className={cn(
              "rounded border border-amber-600 px-4 py-2 text-sm text-amber-400 hover:bg-amber-950/30 disabled:cursor-wait",
              unlocking && "animate-pulse opacity-70",
            )}
          >
            {unlocking ? "處理中…" : `解除鎖定${phase === "content" ? "（將連鎖解鎖後續階段）" : ""}`}
          </button>
          {next ? (
            <Link href={PHASES.find((p) => p.id === next.id)!.href(projectId)} className="cf-btn cf-btn-primary">
              前往 {next.label} →
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** 相容舊 import */
export const ProjectPhaseNav = WvpPhaseNav;
export const PhaseBottomActions = WvpPhaseBottomActions;
export type PhaseNavCurrent = WvpPhaseNavCurrent;
