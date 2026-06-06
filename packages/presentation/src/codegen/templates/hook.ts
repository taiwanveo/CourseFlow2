import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import {
  assetsForChapter,
  buildHookSlides,
  hookNarrationsForSlides,
  hookStepCount,
} from "../hook-slots.js";
import { buildCodegenStepImageBlock } from "../step-image-codegen.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * Hook 開場多圖版型的 codegen。
 *
 * 這裡決定 hook 章節會有幾張 slide、是否包含 close scene、以及 takeover 標題內容。
 * 真正的圖片網格尺寸、主標大小、收束 quote 樣式則在 HookImageStrip.css。
 */
export function generateHookSources(
  input: ChapterCodegenInput,
  opts?: { includeClose?: boolean },
) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const assets = assetsForChapter(input.assets, input.wvpChapterId);
  const slides = buildHookSlides(assets, input.narrations, input.screenContents ?? []);
  const slideCount = slides.length;
  const includeClose = opts?.includeClose ?? input.narrations.length > slideCount + 2;
  const narrations = hookNarrationsForSlides(input.narrations, slideCount, includeClose);
  const takeover =
    narrations[slideCount + 1]?.trim() ||
    input.title;
  const closeLine = includeClose ? narrations[narrations.length - 1] : "";
  const introKicker =
    (input.screenContents?.[0]?.trim() || input.title).slice(0, 24);

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

export { hookStepCount };
