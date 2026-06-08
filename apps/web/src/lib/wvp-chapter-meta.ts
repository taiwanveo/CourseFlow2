import type { CourseComposition, WvpChapterKind } from "@courseflow/core";
import { inferChapterKind } from "@courseflow/presentation/router";
import { titleToWvpChapterId } from "@/lib/wvp-slug";
import { orderedWvpStepsForChapter } from "@/lib/wvp-chapters";
import { screenTextForStep } from "@/lib/wvp-step-text";

function compactSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitShortPhrases(text: string): string[] {
  return compactSpaces(text)
    .split(/[／|｜，。！？；、,.!?;:：\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 將過長螢幕文字收斂為短標（僅供生圖／LLM 提示，不影響 WVP 畫面 TSX）。
 */
export function toScreenHeadline(
  source: string | null | undefined,
  fallback = "重點",
  maxChars = 96,
): string {
  const raw = compactSpaces((source ?? "").replace(/\.\.\.|…/g, ""));
  if (!raw) return fallback;
  const parts = splitShortPhrases(raw);
  const core = parts.length > 0 ? parts.join("／") : raw;
  if (core.length <= maxChars) return core;
  return core.slice(0, Math.max(12, maxChars)).trim();
}

/** WVP 打包用螢幕欄：每步只取 screenContent，不混入口播稿 */
export function screenContentsForChapter(
  composition: CourseComposition,
  chapterId: string,
): string[] {
  const chapterTitle =
    composition.chapters.find((c) => c.id === chapterId)?.title?.trim() ?? "";
  return orderedWvpStepsForChapter(composition, chapterId).map((s) =>
    screenTextForStep(s, chapterTitle),
  );
}

export function resolveCompositionChapterForCraft(
  composition: CourseComposition,
  craft: { title: string; wvp_chapter_id: string; sort_order?: number },
) {
  const normalizedTitle = craft.title.trim();
  const byExactTitle = composition.chapters.find((c) => c.title.trim() === normalizedTitle);
  if (byExactTitle) return byExactTitle;

  const rootChapters = composition.chapters
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const byWvpId = rootChapters.find(
    (ch, index) => titleToWvpChapterId(ch.title, index) === craft.wvp_chapter_id,
  );
  if (byWvpId) return byWvpId;

  if (typeof craft.sort_order === "number" && craft.sort_order >= 0) {
    return rootChapters[craft.sort_order] ?? null;
  }
  return null;
}

export function chapterKindForCraft(
  composition: CourseComposition,
  chapterId: string,
  chapterTitle: string,
  narrations: string[],
  aiPlan?: Record<string, unknown>,
): WvpChapterKind {
  const ch = composition.chapters.find((c) => c.id === chapterId);
  if (ch?.chapterKind) return ch.chapterKind;
  const planKind = (aiPlan?.chapterKind as string) ?? undefined;
  return inferChapterKind({
    chapterTitle,
    narrations,
    screenContents: screenContentsForChapter(composition, chapterId),
    stepVisuals: (aiPlan?.stepVisuals as { step: number; vizType?: string }[]) ?? [],
    planChapterKind: planKind,
  });
}
