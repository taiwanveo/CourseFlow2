import type {
  CourseComposition,
  CompositionChapter,
  CompositionStep,
  StepAudio,
  StepSubtitle,
  StepVisual,
  BgmSettings,
} from "@courseflow/core";
import {
  createEmptyComposition,
  defaultContentTextBoxRect,
  DEFAULT_SUBTITLE_POSITION,
  DEFAULT_SUBTITLE_STYLE,
} from "@courseflow/core";
import type { DbChapter, DbProject, DbStep } from "./types.js";

export function projectToComposition(
  project: DbProject,
  chapters: DbChapter[],
  steps: DbStep[],
  extras?: {
    audio?: StepAudio[];
    subtitles?: StepSubtitle[];
    visuals?: StepVisual[];
    bgm?: BgmSettings;
  },
): CourseComposition {
  const snap = project.composition_snapshot;
  if (snap && typeof snap === "object" && "steps" in snap && Array.isArray(snap.steps) && snap.steps.length > 0) {
    return snap as CourseComposition;
  }

  const composition = createEmptyComposition(
    ((project.settings as { language?: string })?.language) ?? "zh-TW",
  );
  composition.meta.themeId = project.theme_id;
  composition.chapters = chapters.map(
    (c): CompositionChapter => ({
      id: c.id,
      parentId: c.parent_id,
      title: c.title,
      sortOrder: c.sort_order,
    }),
  );
  composition.steps = steps.map(
    (s): CompositionStep => ({
      id: s.id,
      chapterId: s.chapter_id,
      sortOrder: s.sort_order,
      script: s.script,
      screenContent: s.screen_summary,
      infoPool: Array.isArray(s.info_pool) ? (s.info_pool as string[]) : [],
    }),
  );
  if (extras?.audio) composition.audio = extras.audio;
  if (extras?.subtitles) composition.subtitles = extras.subtitles;
  if (extras?.visuals) composition.visuals = extras.visuals;
  if (extras?.bgm) composition.bgm = extras.bgm;
  return composition;
}

export function defaultSubtitleForStep(stepId: string): StepSubtitle {
  return {
    stepId,
    segments: [],
    style: { ...DEFAULT_SUBTITLE_STYLE },
    position: { ...DEFAULT_SUBTITLE_POSITION },
  };
}

export function defaultVisualForStep(stepId: string, screenContent: string): StepVisual {
  return {
    stepId,
    background: { type: "color", color: "#1a1a2e", opacity: 1 },
    elements: [
      {
        id: `${stepId}-hero`,
        type: "text",
        ...defaultContentTextBoxRect(),
        zIndex: 1,
        content: screenContent,
        fontFamily: "Noto Sans TC",
        fontSizePx: 64,
        color: "#ffffff",
        backgroundColor: "transparent",
        backgroundOpacity: 0,
        textAlign: "left",
        lineHeightPx: 10,
      },
    ],
    enterAnimationId: "fade-up",
    transitionId: "crossfade",
  };
}
