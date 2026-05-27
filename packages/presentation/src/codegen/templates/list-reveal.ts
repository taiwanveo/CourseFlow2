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
      const imageUrlAttr = checkpoint?.url?.trim()
        ? `"${escapeTsString(checkpoint.url.trim())}"`
        : `\`\${import.meta.env.BASE_URL}images/${input.wvpChapterId}/${String(wvpStep + 1).padStart(2, "0")}.jpg\``;
      return `  {
    num: ${JSON.stringify(it.num)},
    title: ${JSON.stringify(it.title)},
    body: ${JSON.stringify(it.body)},
    imageUrl: ${imageUrlAttr},
  }`;
    })
    .join(",\n");

  const tsx = `import { ListRevealGrid } from "../../components/ListRevealGrid";
import type { ChapterStepProps } from "../../registry/types";
import "./${componentName}.css";

const ITEMS = [
${itemsLiteral}
] as const;

/** CourseFlow · 清單揭示（1 項 = 1 step） */
export default function ${componentName}({ step }: ChapterStepProps) {
  return (
    <ListRevealGrid
      step={step}
      chapterTitle={${JSON.stringify(input.title)}}
      introTitle={${JSON.stringify(intro)}}
      introSub={${JSON.stringify(introSub)}}
      items={[...ITEMS]}
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
