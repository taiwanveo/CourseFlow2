/** StepDSL v1 執行期型別（presentation 獨立部署，不 import workspace 套件） */
export type StepDslEnter = {
  enterAnimationId: string;
  transitionId: string;
};

export type StepDslScreen = {
  headline: string;
  sub?: string;
};

export type StepDslStepData = {
  step: number;
  layout:
    | "center-title"
    | "visual-focus"
    | "explain-focus"
    | "split-focus"
    | "visual-explain-composite"
    | "beat-scene";
  screen: StepDslScreen & { kicker?: string };
  enter: StepDslEnter;
  visual?: Record<string, unknown>;
  explain?: { pattern: string; params: Record<string, unknown> };
  animationHtml?: string;
  animationStep?: number;
  imageUrl?: string;
  imageStep?: number;
  narration?: string;
  screenRaw?: string;
};

export type StepDslChapterData = {
  version: 1;
  templateKind: string;
  chapterLayout: "per-step" | "list-reveal" | "flow" | "hook";
  kicker: string;
  steps: StepDslStepData[];
  listBundle?: {
    introTitle: string;
    introSub: string;
    items: Array<{
      num: string;
      title: string;
      body: string;
      imageUrl?: string;
      imageStep?: number;
      animationHtml?: string;
      animationConfig?: Record<string, unknown>;
      animationStep?: number;
    }>;
    introImageUrl?: string;
    introImageStep?: number;
    introAnimationHtml?: string;
    introAnimationConfig?: Record<string, unknown>;
    introAnimationStep?: number;
  };
  flowBundle?: {
    intro: string;
    introSub: string;
    nodes: Array<{ id: string; label: string; detail: string }>;
  };
  hookBundle?: {
    introKicker: string;
    slides: Array<{
      url: string | null;
      alt?: string;
      caption?: string;
      label?: string;
    }>;
    takeoverTitle: string;
    closeLine: string;
    includeClose: boolean;
  };
};
