import type {
  CompositionChapter,
  CompositionStep,
  CourseComposition,
  StepSubtitle,
  StepVisual,
} from "./composition.js";
import {
  DEFAULT_SUBTITLE_POSITION,
  DEFAULT_SUBTITLE_STYLE,
} from "./composition.js";
import { defaultContentTextBoxRect } from "./visual-element-style.js";

export function isChapterStep(step: CompositionStep): boolean {
  return step.stepKind === "chapter";
}

export function defaultChapterVisualForStep(stepId: string, title: string): StepVisual {
  return {
    stepId,
    background: { type: "color", color: "#0f172a", opacity: 1 },
    elements: [
      {
        id: `${stepId}-chapter-title`,
        type: "text",
        ...defaultContentTextBoxRect(),
        zIndex: 1,
        content: title,
        fontFamily: "Noto Sans TC",
        fontSizePx: 88,
        color: "#ffffff",
        backgroundColor: "transparent",
        backgroundOpacity: 0,
        textAlign: "center",
        lineHeightPx: 10,
      },
    ],
    enterAnimationId: "scale-in",
    transitionId: "crossfade",
  };
}

function defaultChapterSubtitle(stepId: string): StepSubtitle {
  return {
    stepId,
    segments: [],
    style: { ...DEFAULT_SUBTITLE_STYLE },
    position: { ...DEFAULT_SUBTITLE_POSITION },
  };
}

/** 章節標題變更時，同步章節分隔步驟的文字 */
export function syncChapterDividerTitles(composition: CourseComposition): CourseComposition {
  const chapterById = new Map(composition.chapters.map((c) => [c.id, c]));

  const steps = composition.steps.map((step) => {
    if (step.stepKind !== "chapter") return step;
    const title = chapterById.get(step.chapterId)?.title ?? step.screenContent;
    // 章節分隔頁的 screenContent 應永遠跟章節標題同步，但 script 不一定只是標題：
    // coldopen / outro 等章節可能有完整口播稿，不能在每次 normalize 時被洗回標題。
    const nextScript =
      !step.script.trim() || step.script.trim() === step.screenContent.trim()
        ? title
        : step.script;
    return { ...step, screenContent: title, script: nextScript };
  });

  const visuals = composition.visuals.map((visual) => {
    const step = steps.find((s) => s.id === visual.stepId);
    if (step?.stepKind !== "chapter") return visual;
    const title = chapterById.get(step.chapterId)?.title ?? step.screenContent;
    return {
      ...visual,
      elements: visual.elements.map((el) =>
        el.type === "text" ? { ...el, content: title } : el,
      ),
    };
  });

  return { ...composition, steps, visuals };
}

/**
 * 為每個有內容步驟的章節，在該章節最前面插入「章節分隔頁」步驟（若尚無）。
 */
export function ensureChapterDividerSteps(composition: CourseComposition): CourseComposition {
  let comp = syncChapterDividerTitles({ ...composition });
  const chapters = [...comp.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const chapterIds = new Set(chapters.map((c) => c.id));

  const newSteps: CompositionStep[] = [];
  const addedDividerIds: string[] = [];

  for (const chapter of chapters) {
    const inChapter = comp.steps.filter((s) => s.chapterId === chapter.id);
    const divider = inChapter.find((s) => s.stepKind === "chapter");
    const contentSteps = inChapter
      .filter((s) => s.stepKind !== "chapter")
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (contentSteps.length === 0 && !divider) continue;

    if (!divider) {
      const id = crypto.randomUUID();
      addedDividerIds.push(id);
      newSteps.push({
        id,
        chapterId: chapter.id,
        sortOrder: 0,
        stepKind: "chapter",
        script: chapter.title,
        screenContent: chapter.title,
        infoPool: [`章節：${chapter.title}`],
        estimatedSeconds: 4,
      });
    } else {
      newSteps.push({ ...divider, sortOrder: 0, stepKind: "chapter" });
    }

    contentSteps.forEach((s, i) => {
      newSteps.push({ ...s, stepKind: s.stepKind ?? "content", sortOrder: i + 1 });
    });
  }

  const orphans = comp.steps
    .filter((s) => !chapterIds.has(s.chapterId))
    .map((s) => ({ ...s, stepKind: s.stepKind ?? "content" }));

  let visuals = [...comp.visuals];
  let subtitles = [...comp.subtitles];

  for (const id of addedDividerIds) {
    const step = newSteps.find((s) => s.id === id);
    if (!step) continue;
    if (!visuals.some((v) => v.stepId === id)) {
      visuals = [...visuals, defaultChapterVisualForStep(id, step.screenContent)];
    }
    if (!subtitles.some((s) => s.stepId === id)) {
      subtitles = [...subtitles, defaultChapterSubtitle(id)];
    }
  }

  return {
    ...comp,
    steps: [...newSteps, ...orphans],
    visuals,
    subtitles,
  };
}

export function chapterTitleForStep(
  composition: CourseComposition,
  step: CompositionStep,
): string | null {
  if (step.stepKind !== "chapter") return null;
  return composition.chapters.find((c) => c.id === step.chapterId)?.title ?? step.screenContent;
}
