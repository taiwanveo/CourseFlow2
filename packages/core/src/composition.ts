export type ProjectLanguage = "zh-TW" | "zh-CN" | "en" | string;

export interface CompositionMeta {
  themeId: string | null;
  language: ProjectLanguage;
  width: 1920;
  height: 1080;
}

export interface CompositionChapter {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  /** WVP Craft：章節視覺型別（list-reveal / flow / hook / magazine） */
  chapterKind?: import("./wvp-chapter-kind.js").WvpChapterKind;
}

export interface CompositionStep {
  id: string;
  chapterId: string;
  sortOrder: number;
  /** content：一般教學步驟；chapter：章節開場分隔頁 */
  stepKind?: "content" | "chapter";
  script: string;
  screenContent: string;
  infoPool: string[];
  estimatedSeconds?: number;
  /** B3：宣告式視覺 JSON（VisualConfig） */
  visualConfig?: Record<string, unknown>;
}

export interface StepAudio {
  stepId: string;
  storagePath: string;
  publicUrl?: string;
  durationMs: number;
}

export interface SubtitleWord {
  id?: string;
  text: string;
  start: number;
  end: number;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSizePx: number;
  color: string;
  strokeColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
}

export interface SubtitlePosition {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

export interface StepSubtitle {
  stepId: string;
  segments: SubtitleWord[];
  style: SubtitleStyle;
  position: SubtitlePosition;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Noto Sans TC",
  fontSizePx: 50,
  color: "#ffffff",
  strokeColor: "#000000",
  backgroundColor: "#808080",
  backgroundOpacity: 0.05,
};

export const DEFAULT_SUBTITLE_POSITION: SubtitlePosition = {
  x: 160,
  y: 880,
  scale: 1,
  width: 1600,
  height: 120,
};

export type VisualElementType = "text" | "image";

export interface VisualElementBase {
  id: string;
  type: VisualElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
}

export interface TextVisualElement extends VisualElementBase {
  type: "text";
  content: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  textAlign: "left" | "center" | "right";
  /** 行高（px）：小於字級時視為額外行距；大於等於字級時為絕對 line-height */
  lineHeightPx?: number;
}

export interface ImageVisualElement extends VisualElementBase {
  type: "image";
  storagePath: string;
  publicUrl?: string;
  opacity: number;
}

export type VisualElement = TextVisualElement | ImageVisualElement;

export interface StepBackground {
  type: "color" | "image";
  color?: string;
  storagePath?: string;
  publicUrl?: string;
  opacity: number;
}

export interface StepVisual {
  stepId: string;
  background: StepBackground;
  elements: VisualElement[];
  enterAnimationId: string;
  transitionId: string;
}

export interface BgmSettings {
  storagePath: string | null;
  publicUrl?: string | null;
  volume: number;
}

/**
 * 章節層級視覺覆寫。
 * - visualMode "animation" = 預設步進動畫，不覆寫（Player 沿用 per-step visuals）
 * - visualMode "ai-image" / "upload" = 固定圖片背景（步驟推進只換音訊/字幕，圖不動）
 */
export interface ChapterVisual {
  chapterId: string;
  visualMode: "animation" | "ai-image" | "upload";
  background?: StepBackground;
}

export interface StepTtsConfig {
  stepId: string;
  provider: string;
  voiceId: string;
  model?: string;
}

export interface CourseComposition {
  meta: CompositionMeta;
  chapters: CompositionChapter[];
  steps: CompositionStep[];
  audio: StepAudio[];
  subtitles: StepSubtitle[];
  visuals: StepVisual[];
  bgm: BgmSettings;
  stepTts?: StepTtsConfig[];
  /** 章節層級視覺覆寫（ai-image / upload 模式時覆蓋 per-step visuals） */
  chapterVisuals?: ChapterVisual[];
}

export function createEmptyComposition(
  language: ProjectLanguage = "zh-TW",
): CourseComposition {
  return {
    meta: {
      themeId: null,
      language,
      width: 1920,
      height: 1080,
    },
    chapters: [],
    steps: [],
    audio: [],
    subtitles: [],
    visuals: [],
    bgm: { storagePath: null, volume: 0.3 },
    stepTts: [],
  };
}

export function getOrderedSteps(composition: CourseComposition): CompositionStep[] {
  const chapterOrder = new Map(
    [...composition.chapters]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c, i) => [c.id, i]),
  );
  return [...composition.steps].sort((a, b) => {
    const ca = chapterOrder.get(a.chapterId) ?? 0;
    const cb = chapterOrder.get(b.chapterId) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.sortOrder - b.sortOrder;
  });
}

export function validateContentPhase(composition: CourseComposition): string[] {
  const errors: string[] = [];
  if (composition.chapters.length === 0) {
    errors.push("至少需要一個章節");
  }
  if (composition.steps.length === 0) {
    errors.push("至少需要一個步驟");
  }
  for (const step of composition.steps) {
    if (step.stepKind === "chapter") continue;
    if (!step.script.trim()) {
      errors.push(`步驟「${step.screenContent || step.id}」缺少口播稿`);
    }
  }
  return errors;
}
