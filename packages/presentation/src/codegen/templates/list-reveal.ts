import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName, deriveChapterKicker } from "../chapter-types.js";
import { buildCodegenStepImageBlock, buildCodegenStepAnimationBlock } from "../step-image-codegen.js";
import { assetsForChapter, assetForStep } from "../hook-slots.js";
import { parseListRevealSlots } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

/**
 * 清單揭示版型（list-reveal）的 codegen。
 *
 * 這個檔案決定「章節資料如何餵給 ListRevealGrid 元件」，
 * 但真正的標題字級 / 卡片間距 / 圖片尺寸，多半在 ListRevealGrid.css 調整。
 */
function escapeTsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function generateListRevealSources(input: ChapterCodegenInput) {
  const componentName = `Chapter${chapterComponentName(input.wvpChapterId)}`;
  const { intro, introSub, items } = parseListRevealSlots(
    input.narrations,
    input.screenContents ?? [],
  );
  const chapterAssets = assetsForChapter(input.assets, input.wvpChapterId);
  const introCheckpoint = assetForStep(chapterAssets, 0);
  const animIndices = new Set<number>(
    (input.stepAnimationIndices ?? []).filter((step) =>
      Boolean(input.stepAnimationHtmlByStep?.[step]?.trim()),
    ),
  );

  // 只在確實有圖片或動畫時才傳 introImageUrl / introAnimationUrl；否則 ListRevealGrid 會是文字置中版型。
  // 也就是說：同一個 list-reveal，是否為「大標置中」或「左文右圖」會由這裡決定。
  const hasIntroStepImage = 0 in (input.stepImageExtensions ?? {});
  const hasIntroAnimation = animIndices.has(0);

  let introVisualLine: string;
  if (hasIntroAnimation) {
    introVisualLine = `introAnimationHtml={hasStepAnimation(0) ? stepAnimationSrcDoc(0) : undefined}`;
  } else if (introCheckpoint?.url?.trim()) {
    introVisualLine = `introImageUrl="${escapeTsString(introCheckpoint.url.trim())}"`;
  } else if (hasIntroStepImage) {
    introVisualLine = "introImageUrl={stepImageUrl(0)}";
  } else {
    introVisualLine = ""; // 無圖 → 不傳 prop → showIntroImg=false → 標題自動置中
  }

  const itemsLiteral = items
    .map((it, i) => {
      const wvpStep = i + 1;
      const hasAnim = animIndices.has(wvpStep);
      const checkpoint = assetForStep(chapterAssets, wvpStep);
      let visualLine: string;
      const hasStepImage = wvpStep in (input.stepImageExtensions ?? {});
      if (hasAnim) {
        visualLine = `    animationHtml: hasStepAnimation(${wvpStep}) ? stepAnimationSrcDoc(${wvpStep}) : undefined,\n`;
      } else if (checkpoint?.url?.trim()) {
        visualLine = `    imageUrl: "${escapeTsString(checkpoint.url.trim())}",\n`;
      } else if (hasStepImage) {
        visualLine = `    imageUrl: stepImageUrl(${wvpStep}),\n`;
      } else {
        visualLine = ``;
      }
      return `  {
    num: ${JSON.stringify(it.num)},
    title: ${JSON.stringify(it.title)},
    body: ${JSON.stringify(it.body)},
${visualLine}  }`;
    })
    .join(",\n");

  const stepImageBlock = buildCodegenStepImageBlock(
    input.wvpChapterId,
    input.stepImageExtensions ?? {},
  );
  const stepAnimationBlock = buildCodegenStepAnimationBlock(
    input.wvpChapterId,
    input.stepAnimationIndices ?? [],
    input.stepAnimationHtmlByStep,
  );

  const tsx = `import { ListRevealGrid } from "../../components/ListRevealGrid";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

${stepImageBlock}${stepAnimationBlock}
const ITEMS = [
${itemsLiteral}
] as const;
const STEP_MOTIONS = ${JSON.stringify(input.stepMotions ?? [], null, 2)} as const;

function stepMotion(step: number) {
  const m = STEP_MOTIONS[step] ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };
  return m;
}

/** CourseFlow · 清單揭示（1 項 = 1 step） */
export default function ${componentName}({ step }: ChapterStepProps) {
  const motion = stepMotion(step);
  return (
    <ListRevealGrid
      step={step}
      chapterTitle={${JSON.stringify(deriveChapterKicker(input.wvpChapterId))}}
      introTitle={${JSON.stringify(intro)}}
      introSub={${JSON.stringify(introSub)}}
      items={[...ITEMS]}
      ${introVisualLine}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  // 這裡幾乎不產生專屬 CSS，因為 list-reveal 的主要可調樣式集中在 vendor 的 ListRevealGrid.css。
  const css = `/* ${componentName} — list-reveal 使用 ListRevealGrid 全域樣式 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
