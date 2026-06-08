import type { WvpChapterKind } from "@courseflow/core";
import type { StepDslChapter, StepDslStep } from "../step-dsl/schema.js";
import type { VisualConfig } from "@courseflow/visual-config";
import {
  assetsForChapter,
  assetForStep,
  buildHookSlides,
  padNarrationsForHook,
} from "./hook-slots.js";
import { makeContentAwareStepMotions, splitHeadlineForStaggeredReveal } from "./content-aware.js";
import {
  parseFlowSlots,
  parseListRevealSlots,
  screenTextOnly,
  stripCraftMetadataFromScreen,
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

function sanitizeBeatScreen(screen: string): string {
  return stripCraftMetadataFromScreen(screen)
    .replace(/\s*[（(](?:Beat-Scene|節拍全屏|Visual-Mix|視覺混合|Magazine|雜誌)[^）)]*[）)]\s*/gi, "")
    .trim();
}

function beatScreenForStep(
  input: ChapterCodegenInput,
  step: number,
  dividerKicker?: string,
): { screen: StepDslStep["screen"]; screenRaw: string } {
  const screenRaw = sanitizeBeatScreen(input.screenContents?.[step]?.trim() ?? "");
  const headline = stripNarrationLeakFromScreen(screenTextOnly(screenRaw)) || screenRaw.slice(0, 80);
  const parts = headline.trim() ? splitHeadlineForStaggeredReveal(headline, 2) : [];
  const intro = parts[0] ?? headline;
  const introSub = parts[1] ?? "";
  return {
    screenRaw,
    screen: {
      headline: intro,
      ...(introSub ? { sub: introSub } : {}),
      ...(dividerKicker && step === 0 ? { kicker: dividerKicker } : {}),
    },
  };
}

function remapStepIndexRecord<T>(
  rec: Partial<Record<number, T>> | undefined,
  from: number,
  to = 0,
): Partial<Record<number, T>> | undefined {
  if (!rec || rec[from] === undefined) return rec;
  const next = { ...rec };
  next[to] = rec[from]!;
  if (from !== to) delete next[from];
  return next;
}

/** 分隔頁 + 單一內容步 → 合併為一步全屏節拍（與 beat-scene.ts 一致） */
function mergeBeatDividerInput(input: ChapterCodegenInput): {
  input: ChapterCodegenInput;
  dividerKicker?: string;
  assetSourceStep: (displayStep: number) => number;
} {
  const isDividerPlusOne =
    input.narrations.length === 2 && Boolean(input.screenContents?.[0]?.trim());
  if (!isDividerPlusOne) {
    return { input, assetSourceStep: (s) => s };
  }
  const dividerKicker = screenTextOnly(input.screenContents?.[0]);
  const remappedVisuals = (input.stepVisualConfigs ?? [])
    .filter((v) => v.step === 1)
    .map((v) => ({ ...v, step: 0 }));
  return {
    dividerKicker,
    assetSourceStep: () => 1,
    input: {
      ...input,
      narrations: [input.narrations[1]!],
      screenContents: [input.screenContents?.[1] ?? ""],
      stepMotions: [
        input.stepMotions?.[1] ??
          input.stepMotions?.[0] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" },
      ],
      stepImageExtensions: remapStepIndexRecord(
        input.stepImageExtensions,
        1,
      ) as ChapterCodegenInput["stepImageExtensions"],
      stepAnimationConfigByStep: remapStepIndexRecord(input.stepAnimationConfigByStep, 1),
      stepAnimationHtmlByStep: remapStepIndexRecord(input.stepAnimationHtmlByStep, 1),
      stepAnimationIndices: input.stepAnimationIndices?.includes(1) ? [0] : [],
      stepVisualConfigs: remappedVisuals.length > 0 ? remappedVisuals : input.stepVisualConfigs,
    },
  };
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
  sourceStep = step,
): { imageUrl?: string; imageStep?: number } {
  const assets = assetsForChapter(input.assets, input.wvpChapterId);
  const checkpoint = assetForStep(assets, sourceStep);
  if (checkpoint?.url?.trim()) return { imageUrl: checkpoint.url.trim() };
  if (sourceStep in (input.stepImageExtensions ?? {})) return { imageStep: sourceStep };
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
  if (kind === "magazine") {
    const blob = `${input.title} ${input.narrations.join(" ")}`;
    // 結語／單步章節走 Magazine；其餘（含分隔頁+單內容步）走 Beat-Scene
    if (/結語|結束|outro|conclusion|感謝收看/i.test(blob)) return "magazine";
    if (input.narrations.length <= 1) return "magazine";
    return "beat-scene";
  }
  return "beat-scene";
}

function buildPerStepDsl(
  input: ChapterCodegenInput,
  merged: StepVisualEntry[],
  layout: StepDslStep["layout"],
  opts?: {
    dslKind?: DslTemplateKind;
    dividerKicker?: string;
    assetSourceStep?: (displayStep: number) => number;
  },
): StepDslStep[] {
  const dslKind = opts?.dslKind ?? resolveTemplateKind(input);
  const motionChapterKind: WvpChapterKind =
    dslKind === "visual-mix" || dslKind === "beat-scene" ? "magazine" : dslKind;
  const motions =
    input.stepMotions ??
    makeContentAwareStepMotions(
      input.narrations,
      input.screenContents ?? [],
      motionChapterKind,
    );
  const assetSourceStep = opts?.assetSourceStep ?? ((s: number) => s);

  return input.narrations.map((narration, step) => {
    const visual = visualForStep(step, merged);
    const { explain, animationHtml } = explainForStep(input, step);
    const hasVisual = Boolean(visual);
    const hasExplain = Boolean(explain || animationHtml);
    let stepLayout: StepDslStep["layout"] = layout;
    if (hasVisual && hasExplain) {
      stepLayout = "visual-explain-composite";
    } else if (hasVisual) {
      stepLayout = dslKind === "visual-mix" ? "split-focus" : "visual-focus";
    } else if (hasExplain) {
      stepLayout = "explain-focus";
    } else if (dslKind === "beat-scene") {
      stepLayout = "beat-scene";
    }
    const sourceStep = assetSourceStep(step);
    const beatPack =
      stepLayout === "beat-scene"
        ? beatScreenForStep(input, step, opts?.dividerKicker)
        : null;
    return {
      step,
      layout: stepLayout,
      screen: beatPack?.screen ?? screenForStep(input, step),
      enter: motions[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" },
      ...(visual ? { visual: visual as Record<string, unknown> } : {}),
      ...(explain ? { explain } : {}),
      ...(animationHtml ? { animationHtml } : {}),
      ...animationStepFields(input, step),
      ...stepImageFields(input, step, sourceStep),
      ...(beatPack
        ? { narration, screenRaw: beatPack.screenRaw }
        : {}),
    };
  });
}

/** Beat-Scene 分隔＋單步合併後的口播步數（供 narrations.ts） */
export function codegenNarrationsForChapter(
  input: ChapterCodegenInput,
  chapterDsl: StepDslChapter,
): string[] {
  if (chapterDsl.templateKind === "beat-scene") {
    return mergeBeatDividerInput(input).input.narrations;
  }
  if (chapterDsl.templateKind === "hook" && chapterDsl.hookBundle) {
    return padNarrationsForHook(
      input.narrations,
      chapterDsl.hookBundle.slides.length,
    );
  }
  return input.narrations;
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
    const narrations = padNarrationsForHook(input.narrations, slides.length);
    const takeoverStepIndex = slides.length + 1;
    const hasTakeover = narrations.length > takeoverStepIndex;
    const takeover = hasTakeover ? screenTextOnly(screens[takeoverStepIndex]) : "";
    const includeClose =
      hasTakeover && narrations.length > takeoverStepIndex + 1;
    const closeLine = includeClose
      ? screenTextOnly(screens[narrations.length - 1])
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

  if (templateKind === "beat-scene") {
    const beatResolved = mergeBeatDividerInput(input);
    const beatMerged = mergeStepVisualConfigs(
      beatResolved.input.narrations,
      beatResolved.input.screenContents ?? [],
      beatResolved.input.stepVisualConfigs ?? [],
      animSteps,
    );
    return {
      version: 1,
      templateKind: "beat-scene",
      chapterLayout: "per-step",
      kicker,
      steps: buildPerStepDsl(beatResolved.input, beatMerged, "beat-scene", {
        dslKind: "beat-scene",
        dividerKicker: beatResolved.dividerKicker,
        assetSourceStep: beatResolved.assetSourceStep,
      }),
    };
  }

  return {
    version: 1,
    templateKind: "magazine",
    chapterLayout: "per-step",
    kicker,
    steps: buildPerStepDsl(input, merged, "center-title"),
  };
}
