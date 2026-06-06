"use client";

import { CraftIllustrationStudio } from "@/components/CraftIllustrationStudio";

export function CraftStepIllustrationModal({
  open,
  projectId,
  wvpChapterId,
  chapterTitle,
  disabled,
  onClose,
  onMutate,
}: {
  open: boolean;
  projectId: string;
  wvpChapterId: string;
  chapterTitle: string;
  disabled?: boolean;
  onClose: () => void;
  onMutate?: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-illustration-modal-title"
      onClick={onClose}
    >
      <div
        className="cf-card flex max-h-[92vh] w-full max-w-3xl flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="step-illustration-modal-title"
              className="text-base font-semibold tracking-tight text-zinc-100"
            >
              步驟配圖
            </h2>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{chapterTitle}</p>
          </div>
          <button
            type="button"
            className="cf-btn cf-btn-ghost cf-btn-sm shrink-0"
            onClick={onClose}
            aria-label="關閉"
          >
            關閉
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 sm:px-5">
          <CraftIllustrationStudio
            projectId={projectId}
            wvpChapterId={wvpChapterId}
            disabled={disabled}
            onMutate={onMutate}
          />
        </div>
      </div>
    </div>
  );
}
