"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { CourseComposition, CompositionChapter } from "@courseflow/core";
import { ensureChapterDividerSteps, syncChapterDividerTitles } from "@courseflow/core";
import { cn } from "@/lib/cn";

import { stepCountForChapter } from "@/lib/wvp-chapters";
import {
  addChapter as addChapterMutation,
  addStep as addStepMutation,
  deleteChapter as deleteChapterMutation,
  deleteStep as deleteStepMutation,
  moveStepToChapter,
  reorderSiblingChapters,
  reorderStepsInChapter,
  siblingChapters,
  stepsForChapter,
} from "@/lib/outline-mutations";

type DragKind = "chapter" | "step";
type DropHint = { kind: DragKind; id: string } | null;

const CHAPTER_MIME = "application/x-courseflow-chapter";
const STEP_MIME = "application/x-courseflow-step";

export function OutlineEditor({
  composition,
  onChange,
  selectedStepId,
  onSelectStep,
  onError,
  fillHeight = false,
  projectId,
  chapterWvpIds,
}: {
  composition: CourseComposition;
  onChange: (c: CourseComposition) => void;
  selectedStepId: string | null;
  onSelectStep: (id: string | null) => void;
  onError?: (message: string) => void;
  fillHeight?: boolean;
  projectId?: string;
  chapterWvpIds?: Map<string, string>;
}) {
  const [dragging, setDragging] = useState<DropHint>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);

  const roots = siblingChapters(composition, null);

  const renameChapter = (id: string, title: string) => {
    onChange(
      syncChapterDividerTitles({
        ...composition,
        chapters: composition.chapters.map((c) => (c.id === id ? { ...c, title } : c)),
      }),
    );
  };

  const handleAddChapter = () => {
    const { composition: next } = addChapterMutation(composition);
    onChange(ensureChapterDividerSteps(next));
  };

  const handleAddStep = (chapterId: string) => {
    const { composition: next, stepId } = addStepMutation(composition, chapterId);
    onChange(next);
    onSelectStep(stepId);
  };

  const handleDeleteChapter = (chapterId: string, title: string) => {
    if (!window.confirm(`確定刪除章節「${title || "未命名"}」及其底下所有步驟？`)) return;
    const { composition: next, error } = deleteChapterMutation(composition, chapterId);
    if (error) {
      onError?.(error);
      return;
    }
    if (selectedStepId && !next.steps.some((s) => s.id === selectedStepId)) {
      onSelectStep(next.steps[0]?.id ?? null);
    }
    onChange(next);
  };

  const handleDeleteStep = (stepId: string, label: string) => {
    const step = composition.steps.find((s) => s.id === stepId);
    if (!step || step.stepKind === "chapter") return;
    if (!window.confirm(`確定刪除步驟「${label.slice(0, 40) || "未命名"}」？`)) return;
    const { composition: next, error } = deleteStepMutation(composition, stepId);
    if (error) {
      onError?.(error);
      return;
    }
    if (selectedStepId === stepId) {
      const inChapter = stepsForChapter(next, step.chapterId);
      onSelectStep(inChapter.find((s) => s.stepKind !== "chapter")?.id ?? inChapter[0]?.id ?? null);
    }
    onChange(next);
  };

  const clearDragState = () => {
    setDragging(null);
    setDropHint(null);
  };

  const handleChapterDrop = (targetChapter: CompositionChapter, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const draggedChapterId = event.dataTransfer.getData(CHAPTER_MIME);
    const draggedStepId = event.dataTransfer.getData(STEP_MIME);

    if (draggedChapterId) {
      onChange(
        reorderSiblingChapters(
          composition,
          targetChapter.parentId,
          draggedChapterId,
          targetChapter.id,
        ),
      );
    } else if (draggedStepId) {
      onChange(moveStepToChapter(composition, draggedStepId, targetChapter.id));
    }

    clearDragState();
  };

  const handleStepDrop = (
    targetChapterId: string,
    targetStepId: string,
    event: React.DragEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const draggedStepId = event.dataTransfer.getData(STEP_MIME);
    if (!draggedStepId || draggedStepId === targetStepId) {
      clearDragState();
      return;
    }

    const draggedStep = composition.steps.find((step) => step.id === draggedStepId);
    if (!draggedStep) {
      clearDragState();
      return;
    }

    if (draggedStep.chapterId === targetChapterId) {
      onChange(reorderStepsInChapter(composition, targetChapterId, draggedStepId, targetStepId));
    } else {
      const targetIndex = stepsForChapter(composition, targetChapterId).findIndex(
        (step) => step.id === targetStepId,
      );
      onChange(moveStepToChapter(composition, draggedStepId, targetChapterId, targetIndex));
    }

    clearDragState();
  };

  const renderChapter = (chapter: CompositionChapter, depth: number) => {
    const children = siblingChapters(composition, chapter.id);
    const steps = stepsForChapter(composition, chapter.id);
    const isChapterDropTarget = dropHint?.kind === "chapter" && dropHint.id === chapter.id;

    return (
      <div key={chapter.id} className="outline-chapter">
        <div
          className={cn(
            "flex items-center gap-1 rounded-md px-1 py-1 hover:bg-white/5",
            isChapterDropTarget && "bg-[var(--color-cf-accent)]/10 ring-1 ring-[var(--color-cf-accent)]/40",
          )}
          style={{ paddingLeft: `${depth + 0.25}rem` }}
          onDragOver={(event) => {
            event.preventDefault();
            setDropHint({ kind: "chapter", id: chapter.id });
          }}
          onDragLeave={() => {
            if (dropHint?.id === chapter.id && dropHint.kind === "chapter") {
              setDropHint(null);
            }
          }}
          onDrop={(event) => handleChapterDrop(chapter, event)}
        >
          <span
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(CHAPTER_MIME, chapter.id);
              event.dataTransfer.effectAllowed = "move";
              setDragging({ kind: "chapter", id: chapter.id });
            }}
            onDragEnd={clearDragState}
            className="cursor-grab text-zinc-600 active:cursor-grabbing"
            aria-label="拖曳章節"
            title="拖曳以調整章節順序"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <input
            value={chapter.title}
            onChange={(event) => renameChapter(chapter.id, event.target.value)}
            className="cf-input min-w-0 flex-1 py-0.5 text-xs font-medium"
            aria-label="章節標題"
          />
          <span
            className="shrink-0 text-[10px] text-zinc-500"
            title="試執行與播放器會依此步數推進，含【章節】分隔頁"
          >
            WVP {stepCountForChapter(composition, chapter.id)} 步
          </span>
          <button
            type="button"
            onClick={() => handleAddStep(chapter.id)}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-cf-accent)] hover:bg-white/8"
          >
            + 步驟
          </button>
          <button
            type="button"
            onClick={() => handleDeleteChapter(chapter.id, chapter.title)}
            className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
            aria-label="刪除章節"
            title="刪除章節"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>


        {steps.length > 0 ? (
          <ul
            className="m-0 list-none space-y-0.5 pb-1.5"
            style={{ paddingLeft: `${depth + 1.25}rem` }}
          >
            {steps.map((step) => {
              const isStepDropTarget = dropHint?.kind === "step" && dropHint.id === step.id;
              const isDraggingStep = dragging?.kind === "step" && dragging.id === step.id;

              return (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-center gap-1 rounded-md",
                    isStepDropTarget && "bg-[var(--color-cf-accent)]/10 ring-1 ring-[var(--color-cf-accent)]/40",
                    isDraggingStep && "opacity-40",
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropHint({ kind: "step", id: step.id });
                  }}
                  onDragLeave={() => {
                    if (dropHint?.id === step.id && dropHint.kind === "step") {
                      setDropHint(null);
                    }
                  }}
                  onDrop={(event) => handleStepDrop(chapter.id, step.id, event)}
                >
                  <span
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.setData(STEP_MIME, step.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging({ kind: "step", id: step.id });
                    }}
                    onDragEnd={clearDragState}
                    className="cursor-grab text-zinc-600 active:cursor-grabbing"
                    aria-label="拖曳步驟"
                    title="拖曳以調整步驟順序或移至其他章節"
                  >
                    <GripVertical className="h-3 w-3" />
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectStep(step.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors",
                      selectedStepId === step.id
                        ? "bg-[var(--color-cf-accent)] font-medium text-[var(--accent-foreground)]"
                        : "text-zinc-400 hover:bg-white/8 hover:text-zinc-200",
                    )}
                  >
                    {step.stepKind === "chapter"
                      ? `【章節】${step.screenContent}`
                      : step.screenContent.slice(0, 48) || "（未命名步驟）"}
                  </button>
                  {step.stepKind !== "chapter" ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteStep(
                          step.id,
                          step.screenContent.slice(0, 48) || "（未命名步驟）",
                        )
                      }
                      className="shrink-0 rounded p-0.5 text-zinc-600 hover:bg-red-950/50 hover:text-red-400"
                      aria-label="刪除步驟"
                      title="刪除步驟"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p
            className="pb-1.5 text-[10px] text-zinc-600"
            style={{ paddingLeft: `${depth + 1.25}rem` }}
          >
            尚無步驟
          </p>
        )}

        {children.map((child) => renderChapter(child, depth + 1))}
      </div>
    );
  };

  const addChapterButton = (
    <button
      type="button"
      className="text-xs text-[var(--color-cf-accent)] hover:underline"
      onClick={handleAddChapter}
    >
      + 新增章節
    </button>
  );

  const treeContent =
    roots.length === 0 ? (
      <p className="px-2 py-6 text-center text-xs text-zinc-500">
        尚無章節，請先用 AI 產生大綱或新增章節。
      </p>
    ) : (
      roots.map((chapter) => renderChapter(chapter, 0))
    );

  if (fillHeight) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="cf-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{treeContent}</div>
          <div className="shrink-0 border-t border-[var(--border)] p-2">{addChapterButton}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="cf-card max-h-[min(calc(100vh-14rem),640px)] overflow-y-auto p-1.5">
        {treeContent}
      </div>
      {addChapterButton}
    </div>
  );
}
