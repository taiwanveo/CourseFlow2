import type { WvpChapterKind } from "@courseflow/core";
import type { StepDslChapter, StepDslStep } from "../step-dsl/schema.js";
import type { VisualConfig } from "@courseflow/visual-config";
import {
  assetsForChapter,
  assetForStep,
  buildHookSlides,
} from "./hook-slots.js";
import { makeContentAwareStepMotions } from "./content-aware.js";
import {
  parseFlowSlots,
  parseListRevealSlots,
  screenTextOnly,
  stripNarrationLeakFromScreen,
} from "./slots.js";
import {
  buildHeuristicStepVisualConfigs,
  mergeStepVisualConfigs,
  type StepVisualEntry,
} from "./step-visuals.js";
import { inferChapterKind, isDataVisualChapter } from "./router.js";
import type { ChapterCodegenInput } from "./chapter-types.js";
import { deriveChapterKicker } from "./chapter-types.js";

function resolveEffectiveTemplate(input: ChapterCodegenInput): WvpChapterKind {
  if (input.forceTemplate) return input.forceTemplate;
  if (input.chapterKind) return input.chapterKind;
  return inferChapterKind({
    chapterTitle: input.title,
    narrations: input.narrations,
    stepVisuals: input.stepVisuals,
    planChapterKind: undefined,
    screenContents: input.screenContents,
  });
}

function screenForStep(input: ChapterCodegenInput, step: number): {
  headline: string;
  sub?: string;
} {
  const raw = input.screenContents?.[step]?.trim() ?? "";
  const headline = stripNarrationLeakFromScreen(screenTextOnly(raw)) || raw.slice(0, 48);
  const parts = headline.split(/[／|｜]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { headline: parts[0]!, sub: parts.slice(1).join("／") };
  }
  return { headline };
}

function visualForStep(
  step: number,
  merged: StepVisualEntry[],
): VisualConfig | undefined {
  return merged.find((e) => e.step === step)?.config;
}

function explainForStep(
  input: ChapterCodegenInput,
  step: number,
): { explain?: StepDslStep["explain"]; animationHtml?: string } {
  const cfg = input.stepAnimationConfigByStep?.[step];
  if (cfg && typeof cfg === "object" && typeof (cfg as { pattern?: string }).pattern === "string") {
    return { explain: cfg as StepDslStep["explain"] };
  }
  const html = input.stepAnimationHtmlByStep?.[step]?.trim();
  if (html) return { animationHtml: html };
  return {};
}

function stepImageFields(
  input: ChapterCodegenInput,
  step: number,
): { imageUrl?: string; imageStep?: number } {
  const assets = assetsForChapter(input.assets, input.wvpChapterId);
  const checkpoint = assetForStep(assets, step);
  if (checkpoint?.url?.trim()) return { imageUrl: checkpoint.url.trim() };
  if (step in (input.stepImageExtensions ?? {})) return { imageStep: step };
  return {};
}

function animationStepFields(
  input: ChapterCodegenInput,
  step: number,
): { animationStep?: number } {
  const hasAnim =
    Boolean(input.stepAnimationConfigByStep?.[step]) ||
    Boolean(input.stepAnimationHtmlByStep?.[step]?.trim());
  return hasAnim ? { animationStep: step } : {};
}

type DslTemplateKind = StepDslChapter["templateKind"];

function resolveTemplateKind(input: ChapterCodegenInput): DslTemplateKind {
  const dataVisual = isDataVisualChapter({
    chapterTitle: input.title,
    narrations: input.narrations,
    screenContents: input.screenContents,
  });
  if (dataVisual && input.narrations.length >= 2) return "visual-mix";
  const kind = resolveEffectiveTemplate(input);
  if (kind === "hook") return "hook";
  if (kind === "list-reveal") return "list-reveal";
  if (kind === "flow") return "flow";
  if (kind === "magazine") return "magazine";
  return "beat-scene";
}

function buildPerStepDsl(
  input: ChapterCodegenInput,
  merged: StepVisualEntry[],
  layout: StepDslStep["layout"],
): StepDslStep[] {
  const dslKind = resolveTemplateKind(input);
  const motionChapterKind: WvpChapterKind =
    dslKind === "visual-mix" || dslKind === "beat-scene" ? "magazine" : dslKind;
  const motions =
    input.stepMotions ??
    makeContentAwareStepMotions(
      input.narrations,
      input.screenContents ?? [],
      motionChapterKind,
    );

  return input.narrations.map((_, step) => {
    const visual = visualForStep(step, merged);
    const { explain, animationHtml } = explainForStep(input, step);
    const stepLayout: StepDslStep["layout"] = visual
      ? "visual-focus"
      : explain || animationHtml
        ? "explain-focus"
        : layout;
    return {
      step,
      layout: stepLayout,
      screen: screenForStep(input, step),
      enter: motions[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" },
      ...(visual ? { visual: visual as Record<string, unknown> } : {}),
      ...(explain ? { explain } : {}),
      ...(animationHtml ? { animationHtml } : {}),
      ...animationStepFields(input, step),
      ...stepImageFields(input, step),
    };
  });
}

export function buildStepDslFromChapterInput(input: ChapterCodegenInput): StepDslChapter {
  const templateKind = resolveTemplateKind(input);
  const kicker = deriveChapterKicker(input.wvpChapterId);
  const animSteps = new Set(
    (input.stepAnimationIndices ?? []).filter(
      (s) =>
        Boolean(input.stepAnimationConfigByStep?.[s]) ||
        Boolean(input.stepAnimationHtmlByStep?.[s]?.trim()),
    ),
  );
  const dataVisual = templateKind === "visual-mix";
  let merged = mergeStepVisualConfigs(
    input.narrations,
    input.screenContents ?? [],
    input.stepVisualConfigs ?? [],
    animSteps,
  );
  if (dataVisual && merged.length === 0) {
    merged = buildHeuristicStepVisualConfigs(
      input.narrations,
      input.screenContents ?? [],
    );
  }

  if (templateKind === "hook") {
    const assets = assetsForChapter(input.assets, input.wvpChapterId);
    const slides = buildHookSlides(assets, input.narrations.length, input.screenContents ?? []);
    const screens = input.screenContents ?? [];
    const slideCount = slides.length;
    const takeoverStepIndex = slideCount + 1;
    const hasTakeover = input.narrations.length > takeoverStepIndex;
    const takeover = hasTakeover ? screenTextOnly(screens[takeoverStepIndex]) : "";
    const includeClose =
      hasTakeover && input.narrations.length > takeoverStepIndex + 1;
    const closeLine = includeClose
      ? screenTextOnly(screens[input.narrations.length - 1])
      : "";
    const introKicker = screenTextOnly(screens[0]).slice(0, 48);
    const steps = buildPerStepDsl(input, merged, "center-title");

    return {
      version: 1,
      templateKind: "hook",
      chapterLayout: "hook",
      kicker,
      steps,
      hookBundle: {
        introKicker,
        slides: slides.map((s) => ({
          url: s.url,
          alt: s.alt,
          caption: s.caption,
          label: s.label,
        })),
        takeoverTitle: takeover,
        closeLine,
        includeClose,
      },
    };
  }

  if (templateKind === "list-reveal" && input.narrations.length >= 2) {
    const { intro, introSub, items } = parseListRevealSlots(
      input.narrations,
      input.screenContents ?? [],
    );
    const introExplain = explainForStep(input, 0);
    const listItems = items.map((it, i) => {
      const wvpStep = i + 1;
      const ex = explainForStep(input, wvpStep);
      return {
        num: it.num,
        title: it.title,
        body: it.body,
        ...stepImageFields(input, wvpStep),
        ...animationStepFields(input, wvpStep),
        ...(ex.explain
          ? { animationConfig: ex.explain as unknown as Record<string, unknown> }
          : {}),
        ...(ex.animationHtml ? { animationHtml: ex.animationHtml } : {}),
      };
    });
    const introImgFields = stepImageFields(input, 0);
    return {
      version: 1,
      templateKind: "list-reveal",
      chapterLayout: "list-reveal",
      kicker,
      steps: buildPerStepDsl(input, merged, "center-title"),
      listBundle: {
        introTitle: intro,
        introSub,
        items: listItems,
        ...introImgFields,
        ...animationStepFields(input, 0),
        ...(introExplain.explain
          ? {
              introAnimationConfig: introExplain.explain as unknown as Record<string, unknown>,
            }
          : {}),
        ...(introExplain.animationHtml
          ? { introAnimationHtml: introExplain.animationHtml }
          : {}),
      },
    };
  }

  if (templateKind === "flow" && input.narrations.length >= 2) {
    const { intro, introSub, nodes } = parseFlowSlots(
      input.narrations,
      input.screenContents ?? [],
    );
    return {
      version: 1,
      templateKind: "flow",
      chapterLayout: "flow",
      kicker,
      steps: buildPerStepDsl(input, merged, "center-title"),
      flowBundle: {
        intro,
        introSub,
        nodes,
      },
    };
  }

  if (templateKind === "visual-mix") {
    return {
      version: 1,
      templateKind: "visual-mix",
      chapterLayout: "per-step",
      kicker,
      steps: buildPerStepDsl(input, merged, "visual-focus"),
    };
  }

  return {
    version: 1,
    templateKind: templateKind === "magazine" ? "magazine" : "beat-scene",
    chapterLayout: "per-step",
    kicker,
    steps: buildPerStepDsl(input, merged, "center-title"),
  };
}
