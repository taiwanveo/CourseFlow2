import type { CourseComposition, WvpChapterKind } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import { inferChapterKind } from "@courseflow/presentation";
import { titleToWvpChapterId } from "@/lib/wvp-slug";

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
 * 將任意長文本收斂為螢幕短標，避免把口播長句直接上螢幕。
 */
export function toScreenHeadline(
  source: string | null | undefined,
  fallback = "重點",
  maxChars = 42,
): string {
  const raw = compactSpaces((source ?? "").replace(/\.\.\.|…/g, ""));
  if (!raw) return fallback;
  const parts = splitShortPhrases(raw);
  const core = parts.length > 0 ? parts.slice(0, 3).join("／") : raw;
  if (core.length <= maxChars) return core;
  return core.slice(0, Math.max(8, maxChars)).trim();
}

export function screenContentsForChapter(
  composition: CourseComposition,
  chapterId: string,
): string[] {
  return composition.steps
    .filter((s) => s.chapterId === chapterId && !isChapterStep(s))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => toScreenHeadline(s.screenContent, "重點"));
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
    stepVisuals: (aiPlan?.stepVisuals as { step: number; vizType?: string }[]) ?? [],
    planChapterKind: planKind,
  });
}
