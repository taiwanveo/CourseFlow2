import type { CourseComposition, WvpChapterKind } from "@courseflow/core";
import { isDataVisualChapter } from "@courseflow/presentation";
import {
  chapterKindForCraft,
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
} from "@/lib/wvp-chapter-meta";
import { narrationsForChapter, type ChapterCraftRow } from "@/lib/wvp-chapters";
import { templateKindDisplayLabel } from "@/lib/wvp-template-kind-label";

/** 視覺動效階段可手動覆寫的版型（與文稿內容階段一致） */
export const CRAFT_TEMPLATE_OPTIONS: { value: WvpChapterKind; label: string }[] = [
  { value: "hook", label: "多圖開場" },
  { value: "list-reveal", label: "清單揭示" },
  { value: "flow", label: "流程圖" },
  { value: "magazine", label: "雜誌" },
];

export type ChapterTemplateSelectState = {
  contentChapterId: string | null;
  storedKind: WvpChapterKind | undefined;
  inferredKind: WvpChapterKind;
  /** 使用者看到的推斷版型（數據視覺章為 visual-mix，與 inferredKind 可能不同） */
  inferredDisplayKind: string;
  /** 下拉選單顯示值：未覆寫時為推斷結果，否則為使用者指定 */
  selectValue: WvpChapterKind;
  isAuto: boolean;
};

export function resolveChapterTemplateSelectState(
  composition: CourseComposition,
  craft: Pick<ChapterCraftRow, "title" | "wvp_chapter_id" | "sort_order"> & {
    checklist_result?: { aiPlan?: unknown };
  },
): ChapterTemplateSelectState {
  const contentChapter = resolveCompositionChapterForCraft(composition, craft);
  const narrations = contentChapter
    ? narrationsForChapter(composition, contentChapter.id)
    : [];
  const aiPlan =
    craft.checklist_result?.aiPlan &&
    typeof craft.checklist_result.aiPlan === "object"
      ? (craft.checklist_result.aiPlan as Record<string, unknown>)
      : undefined;
  const screenContents = contentChapter
    ? screenContentsForChapter(composition, contentChapter.id)
    : [];
  const inferredKind: WvpChapterKind = contentChapter
    ? chapterKindForCraft(
        composition,
        contentChapter.id,
        craft.title,
        narrations,
        aiPlan,
      )
    : "magazine";
  const dataVisual = isDataVisualChapter({
    chapterTitle: craft.title,
    narrations,
    screenContents,
  });
  const inferredDisplayKind = dataVisual ? "visual-mix" : inferredKind;
  const storedKind = contentChapter?.chapterKind;
  return {
    contentChapterId: contentChapter?.id ?? null,
    storedKind,
    inferredKind,
    inferredDisplayKind,
    selectValue: storedKind ?? inferredKind,
    isAuto: !storedKind,
  };
}

export function craftTemplateOptionLabel(kind: WvpChapterKind): string {
  return templateKindDisplayLabel(kind);
}
