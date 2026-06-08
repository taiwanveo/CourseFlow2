import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import {
  assetsForChapter,
  buildHookSlides,
  hookSlideCount,
} from "../hook-slots.js";
import { screenTextOnly } from "../slots.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Hook 開場多圖版型。
 * 規則：narrations = 口播稿（字幕）；screenContents = 螢幕文字（畫面）。禁止互相 fallback。
 */
export function generateHookSources(
  input: ChapterCodegenInput,
  opts?: { includeClose?: boolean },
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const assets = assetsForChapter(input.assets, input.wvpChapterId);
  const narrations = input.narrations;
  const screens = input.screenContents ?? [];
  const slideCount = hookSlideCount(narrations.length);
  const slides = buildHookSlides(assets, narrations.length, screens);
  const takeoverStepIndex = slideCount + 1;
  const hasTakeoverStep = narrations.length > takeoverStepIndex;
  const takeover = hasTakeoverStep ? screenTextOnly(screens[takeoverStepIndex]) : "";
  const includeClose =
    opts?.includeClose ??
    (hasTakeoverStep && narrations.length > takeoverStepIndex + 1);
  const closeLine = includeClose
    ? screenTextOnly(screens[narrations.length - 1])
    : "";
  const introKicker = screenTextOnly(screens[0]).slice(0, 48);

  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );

  const slidesJson = JSON.stringify(
    slides.map((s) => ({
      url: s.url,
      alt: s.alt,
      caption: s.caption,
      label: s.label,
    })),
    null,
    2,
  );

  const tsx = `import { HookImageStrip } from "../../components/HookImageStrip";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

${stepImageBlock}
const SLIDES = ${slidesJson} as const;
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

function stepMotion(step: number) {
  return STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
}

function resolveSlideUrl(slideIndex: number, checkpointUrl: string | null): string | null {
  if (checkpointUrl?.trim()) return checkpointUrl.trim();
  const wvpStep = slideIndex + 1;
  if (STEP_IMAGE_EXT[wvpStep]) return stepImageUrl(wvpStep);
  if (slideIndex === 0 && STEP_IMAGE_EXT[0]) return stepImageUrl(0);
  return null;
}

/** CourseFlow · Hook 多圖開場 */
export default function ${componentName}({ step }: ChapterStepProps) {
  const motion = stepMotion(step);
  const slides = SLIDES.map((s, idx) => ({
    ...s,
    url: resolveSlideUrl(idx, s.url),
  }));
  return (
    <HookImageStrip
      step={step}
      chapterTitle={${JSON.stringify(deriveChapterKicker(input.wvpChapterId))}}
      introKicker={${JSON.stringify(introKicker)}}
      slides={slides}
      takeoverTitle={${JSON.stringify(takeover)}}
      closeLine={${JSON.stringify(closeLine)}}
      includeClose={${includeClose}}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  const css = `/* ${componentName} — hook 使用 HookImageStrip 全域樣式 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs({ ...input, narrations }),
    narrations,
    templateKind: "hook" as const,
  };
}
