"use client";

import Link from "next/link";
import type { PhaseId } from "@courseflow/core";
import { canAccessPhase } from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { cn } from "@/lib/cn";
import { ExportMp4Button } from "@/components/ExportMp4Button";

const PHASES: { id: PhaseId; label: string; href: (id: string) => string }[] = [
  { id: "content", label: "1. 文稿內容", href: (id) => `/projects/${id}/content` },
  { id: "audio", label: "2. 語音字幕", href: (id) => `/projects/${id}/audio` },
  { id: "visual", label: "3. 視覺動效", href: (id) => `/projects/${id}/visual` },
];

export type PhaseNavCurrent = PhaseId | "play";

export function PhaseNav({
  projectId,
  current,
  locks,
}: {
  projectId: string;
  current: PhaseNavCurrent;
  locks: PhaseLocks;
}) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
      {PHASES.map((p) => {
        const accessible = canAccessPhase(locks, p.id);
        const active = p.id === current;
        return (
          <Link
            key={p.id}
            href={accessible ? p.href(projectId) : "#"}
            className={cn(
              "cf-btn cf-btn-sm",
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
            {locks[p.id] ? " · 已鎖" : ""}
          </Link>
        );
      })}
      {locks.visual ? (
        <>
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
        </>
      ) : null}
    </nav>
  );
}
