import type { CourseComposition, WvpChapterKind } from "@courseflow/core";
import { isChapterStep } from "@courseflow/core";
import { inferChapterKind } from "@courseflow/presentation/router";
import { titleToWvpChapterId } from "@/lib/wvp-slug";
import { orderedWvpStepsForChapter } from "@/lib/wvp-chapters";

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
  maxChars = 96,
): string {
  const raw = compactSpaces((source ?? "").replace(/\.\.\.|…/g, ""));
  if (!raw) return fallback;
  const parts = splitShortPhrases(raw);
  const core = parts.length > 0 ? parts.join("／") : raw;
  if (core.length <= maxChars) return core;
  return core.slice(0, Math.max(12, maxChars)).trim();
}

function stripEditorChapterLabel(text: string): string {
  return compactSpaces(text.replace(/^【章節】\s*/, "").replace(/\.\.\.|…/g, ""));
}

/** 螢幕欄是否實際上是口播稿（避免從 @courseflow/presentation 主入口匯入） */
function screenReadsLikeNarration(screen: string, script: string): boolean {
  const s = screen.replace(/\s+/g, " ").trim();
  const t = script.replace(/\s+/g, " ").trim();
  if (!s || !t) return false;
  if (s.length >= 28 && t.includes(s)) return true;
  if (s.length >= 40 && s.includes(t.slice(0, Math.min(48, t.length)))) return true;
  const first = t.split(/[。！？.!?]/)[0]?.trim() ?? "";
  if (first.length >= 12 && s.includes(first)) return true;
  return false;
}

/** 剝除 craft 後設字串（與 @courseflow/presentation slots 同步邏輯） */
function stripCraftMetadataFromScreen(text: string): string {
  let t = compactSpaces(text.replace(/\.\.\.|…/g, ""));
  if (!t) return "";
  const quoted = t.match(
    /(?:章節分隔頁的)?(?:螢幕|畫面|屏幕)(?:內容|文字)?(?:是|為)?[「『"]([^」』"]+)[」』"]/,
  );
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const narrationCut = t.search(/\s*口播稿(?:為|是|：|:)/);
  if (narrationCut > 0) t = t.slice(0, narrationCut).trim();
  return t
    .replace(/^章節分隔頁的(?:螢幕|畫面)內容(?:是|為)\s*/i, "")
    .replace(/\s*口播稿(?:為|是|：|:).+$/i, "")
    .trim();
}

/** 供 WVP 模板／生圖使用的螢幕短語：禁止把口播稿當畫面文字 */
export function sanitizeScreenContentForCodegen(screen: string, script: string): string {
  const stripped = stripCraftMetadataFromScreen(screen);
  const raw = compactSpaces(stripped);
  if (!raw) return "";
  if (raw.length > 40 || screenReadsLikeNarration(raw, script)) {
    return toScreenHeadline(raw, "重點", 32);
  }
  return raw;
}

export function screenContentsForChapter(
  composition: CourseComposition,
  chapterId: string,
): string[] {
  const chapterTitle =
    composition.chapters.find((c) => c.id === chapterId)?.title?.trim() ?? "";
  return orderedWvpStepsForChapter(composition, chapterId).map((s) => {
    if (isChapterStep(s)) {
      const custom = stripEditorChapterLabel(s.screenContent ?? "");
      if (custom && custom !== chapterTitle) return custom;
      return chapterTitle || custom;
    }
    const raw = compactSpaces((s.screenContent ?? "").replace(/\.\.\.|…/g, ""));
    return sanitizeScreenContentForCodegen(raw, s.script ?? "");
  });
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
