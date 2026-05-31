import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import {
  assetsForChapter,
  buildHookSlides,
  hookNarrationsForSlides,
  hookStepCount,
} from "../hook-slots.js";
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
  const introKicker = narrations[0]?.slice(0, 24) || input.title;

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

const SLIDES = ${slidesJson} as const;
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

function stepMotion(step: number) {
  return STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
}

/** CourseFlow · Hook 多圖開場 */
export default function ${componentName}({ step }: ChapterStepProps) {
  const motion = stepMotion(step);
  return (
    <HookImageStrip
      step={step}
      chapterTitle={${JSON.stringify(deriveChapterKicker(input.wvpChapterId))}}
      introKicker={${JSON.stringify(introKicker)}}
      slides={[...SLIDES]}
      takeoverTitle={${JSON.stringify(takeover)}}
      closeLine={${JSON.stringify(closeLine)}}
      includeClose={${includeClose}}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  // hook 版型實際可調樣式集中在 vendor CSS，這裡僅讓每章掛入同一套樣式表。
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
