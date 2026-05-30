import { randomUUID } from "node:crypto";
import type {
  CompositionChapter,
  CompositionStep,
  CourseComposition,
  WvpChapterKind,
} from "@courseflow/core";
import { createEmptyComposition } from "@courseflow/core";

export interface GeneratedChapterInput {
  title: string;
  sortOrder: number;
  chapterKind?: WvpChapterKind;
  children?: GeneratedChapterInput[];
  /**
   * 章節分隔頁的口播稿（對應資料結構中的 {章節N標題口播稿}）。
   * 若存在，則在章節第 0 個位置自動預建章節分隔頁步驟，避免 ensureChapterDividerSteps 再覆寫。
   */
  chapterScript?: string;
  steps: {
    screenContent: string;
    infoPool: string[];
    estimatedSeconds: number;
    script?: string;
  }[];
}

export function flattenGeneratedChapters(
  chapters: GeneratedChapterInput[],
  parentId: string | null = null,
): { chapters: CompositionChapter[]; steps: CompositionStep[] } {
  const outChapters: CompositionChapter[] = [];
  const outSteps: CompositionStep[] = [];

  function walk(list: GeneratedChapterInput[], parent: string | null) {
    list.forEach((ch, ci) => {
      const chapterId = randomUUID();
      outChapters.push({
        id: chapterId,
        parentId: parent,
        title: ch.title,
        sortOrder: ch.sortOrder ?? ci,
        chapterKind: ch.chapterKind,
      });

      let stepSortOffset = 0;

      // 若提供了 chapterScript，自動在 sortOrder=0 預建章節分隔頁步驟
      // ensureChapterDividerSteps 會偵測到已存在分隔頁而不再增加
      if (ch.chapterScript?.trim()) {
        outSteps.push({
          id: randomUUID(),
          chapterId,
          sortOrder: 0,
          stepKind: "chapter",
          script: ch.chapterScript.trim(),
          screenContent: ch.title,
          infoPool: [`章節：${ch.title}`],
          estimatedSeconds: Math.max(4, Math.round(ch.chapterScript.trim().length / 4)),
        });
        stepSortOffset = 1;
      }

      ch.steps.forEach((st, si) => {
        outSteps.push({
          id: randomUUID(),
          chapterId,
          sortOrder: si + stepSortOffset,
          script: st.script ?? "",
          screenContent: st.screenContent,
          infoPool: st.infoPool ?? [],
          estimatedSeconds: st.estimatedSeconds,
        });
      });
      if (ch.children?.length) walk(ch.children, chapterId);
    });
  }

  walk(chapters, parentId);
  return { chapters: outChapters, steps: outSteps };
}

export function applyOutlineToComposition(
  composition: CourseComposition,
  generated: GeneratedChapterInput[],
): CourseComposition {
  const { chapters, steps } = flattenGeneratedChapters(generated);
  return { ...composition, chapters, steps };
}

export function mergeScripts(
  composition: CourseComposition,
  scripts: Map<string, string>,
): CourseComposition {
  return {
    ...composition,
    steps: composition.steps.map((s) => ({
      ...s,
      script: scripts.get(s.id) ?? s.script,
    })),
  };
}

export function createCompositionFromArticle(
  language: string,
  generated: GeneratedChapterInput[],
): CourseComposition {
  const base = createEmptyComposition(language);
  return applyOutlineToComposition(base, generated);
}

export { createEmptyComposition };
