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
      ch.steps.forEach((st, si) => {
        outSteps.push({
          id: randomUUID(),
          chapterId,
          sortOrder: si,
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
