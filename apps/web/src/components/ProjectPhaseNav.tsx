"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WVP_PHASE_ORDER,
  canAccessWvpPhase,
  canEditWvpPhase,
  wvpPhaseAccessBlockedReason,
  type WvpPhaseId,
  type WvpPhaseLocks,
} from "@courseflow/core";
import { cn } from "@/lib/cn";
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

  const lockPhase = async (phase: WvpPhaseId) => {
    if (!isPlayPage && phase === current && onBeforeLock) {
      await onBeforeLock();
    }
    const res = await fetch(`/api/projects/${projectId}/wvp/phases/${phase}/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "鎖定失敗", "error");
      return;
    }
    onLocksChange(data.wvp_phase_locks);
    const n = PHASES.find((p) => p.id === phase)?.label ?? phase;
    toast(`${n} 已鎖定`, "success");
  };

  const unlockPhase = async (phase: WvpPhaseId) => {
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
    onLocksChange(data.wvp_phase_locks);
    router.refresh();
    toast("已解除鎖定", "info");
  };

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
                    className="w-full rounded border border-amber-600/80 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-950/40"
                  >
                    解除鎖定
                  </button>
                ) : showLock ? (
                  <button
                    type="button"
                    onClick={() => lockPhase(p.id)}
                    className="w-full rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-black hover:opacity-90"
                  >
                    鎖定
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
            onClick={onUnlock}
            className="rounded border border-amber-600 px-4 py-2 text-sm text-amber-400 hover:bg-amber-950/30"
          >
            解除鎖定
            {phase === "content" ? "（將連鎖解鎖後續階段）" : ""}
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
