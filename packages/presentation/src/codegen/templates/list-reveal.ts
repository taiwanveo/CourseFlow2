import type { ChapterCodegenInput } from "../chapter-types.js";
import { chapterComponentName } from "../chapter-types.js";
import { assetsForChapter, assetForStep } from "../hook-slots.js";
import { parseListRevealSlots } from "../slots.js";
import { buildNarrationsTs } from "../narrations-ts.js";

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
  const itemsLiteral = items
    .map((it, i) => {
      const wvpStep = i + 1;
      const checkpoint = assetForStep(chapterAssets, wvpStep);
      const imageUrlLine = checkpoint?.url?.trim()
        ? `    imageUrl: "${escapeTsString(checkpoint.url.trim())}",\n`
        : "";
      return `  {
    num: ${JSON.stringify(it.num)},
    title: ${JSON.stringify(it.title)},
    body: ${JSON.stringify(it.body)},
${imageUrlLine}  }`;
    })
    .join(",\n");

  const tsx = `import { ListRevealGrid } from "../../components/ListRevealGrid";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

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
      chapterTitle={${JSON.stringify(input.title)}}
      introTitle={${JSON.stringify(intro)}}
      introSub={${JSON.stringify(introSub)}}
      items={[...ITEMS]}
      enterAnimationId={motion.enterAnimationId}
      transitionId={motion.transitionId}
    />
  );
}
`;

  const css = `/* ${componentName} — list-reveal 使用 ListRevealGrid 全域樣式 */\n`;

  return {
    componentFileName: `${componentName}.tsx`,
    componentName,
    tsx,
    css,
    narrationsTs: buildNarrationsTs(input),
  };
}
