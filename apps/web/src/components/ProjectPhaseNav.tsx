"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PhaseId, PhaseLocks } from "@courseflow/core";
import { PHASE_ORDER, canAccessPhase } from "@courseflow/core";
import { cn } from "@/lib/cn";
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { useToast } from "@/components/Toast";
import type { PhaseNavCurrent } from "@/components/PhaseNav";

const PHASES: { id: PhaseId; label: string; href: (id: string) => string }[] = [
  { id: "content", label: "1. 文稿內容", href: (id) => `/projects/${id}/content` },
  { id: "audio", label: "2. 語音字幕", href: (id) => `/projects/${id}/audio` },
  { id: "visual", label: "3. 視覺動效", href: (id) => `/projects/${id}/visual` },
];

const NEXT_PHASE: Partial<Record<PhaseId, { id: PhaseId; label: string }>> = {
  content: { id: "audio", label: "2. 語音字幕" },
  audio: { id: "visual", label: "3. 視覺動效" },
  visual: { id: "visual", label: "播放" },
};

function canLockPhase(locks: PhaseLocks, phase: PhaseId): boolean {
  if (locks[phase]) return false;
  if (phase === "content") return true;
  if (phase === "audio") return locks.content;
  if (phase === "visual") return locks.content && locks.audio;
  return false;
}

export function ProjectPhaseNav({
  projectId,
  current,
  locks,
  onLocksChange,
  onBeforeLock,
}: {
  projectId: string;
  current: PhaseNavCurrent;
  locks: PhaseLocks;
  onLocksChange: (locks: PhaseLocks) => void;
  /** 鎖定目前階段前先儲存（僅 current 為 PhaseId 時會呼叫） */
  onBeforeLock?: () => Promise<void>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isPlayPage = current === "play";

  const lockPhase = async (phase: PhaseId) => {
    if (!isPlayPage && phase === current && onBeforeLock) {
      await onBeforeLock();
    }
    const res = await fetch(`/api/projects/${projectId}/phases/${phase}/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "鎖定失敗", "error");
      return;
    }
    onLocksChange(data.phase_locks);
    const n = PHASES.find((p) => p.id === phase)?.label ?? phase;
    toast(`${n} 已鎖定`, "success");
  };

  const unlockPhase = async (phase: PhaseId) => {
    const res = await fetch(`/api/projects/${projectId}/phases/${phase}/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "解除鎖定失敗", "error");
      return;
    }
    onLocksChange(data.phase_locks);
    router.refresh();
    toast("已解除鎖定", "info");
  };

  return (
    <nav className="mb-6 border-b border-[var(--border)] pb-4">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        {PHASES.map((p) => {
          const accessible = canAccessPhase(locks, p.id);
          const active = p.id === current;
          const isLocked = locks[p.id];
          const showLock =
            !isLocked && p.id === current && !isPlayPage && canLockPhase(locks, p.id);

          return (
            <div key={p.id} className="flex min-w-[9.5rem] flex-col gap-1.5">
              <Link
                href={accessible ? p.href(projectId) : "#"}
                className={cn(
                  "cf-btn cf-btn-sm w-full justify-center",
                  active && "cf-btn-primary",
                  !active && accessible && "cf-btn-secondary",
                  !accessible && "pointer-events-none opacity-40",
                )}
                aria-disabled={!accessible}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (!accessible) e.preventDefault();
                }}
              >
                {p.label}
                {isLocked ? " · 已鎖" : ""}
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
                    解除鎖定
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {locks.visual ? (
          <div className="flex flex-col gap-1.5 self-start">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/projects/${projectId}/play`}
                className={cn(
                  "cf-btn cf-btn-sm",
                  current === "play" ? "cf-btn-primary" : "cf-btn-secondary",
                )}
                aria-current={current === "play" ? "page" : undefined}
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

/** 頁面底部：儲存、解除鎖定後的「下一階段」捷徑 */
export function PhaseBottomActions({
  projectId,
  phase,
  locks,
  saving,
  onSave,
  onUnlock,
}: {
  projectId: string;
  phase: PhaseId;
  locks: PhaseLocks;
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
          {next && phase !== "visual" ? (
            <Link
              href={
                next.id === "visual"
                  ? `/projects/${projectId}/visual`
                  : `/projects/${projectId}/${next.id}`
              }
              className="cf-btn cf-btn-primary"
            >
              前往 {next.label} →
            </Link>
          ) : null}
          {locked && phase === "visual" ? (
            <Link href={`/projects/${projectId}/play`} className="cf-btn cf-btn-primary">
              前往播放 →
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}