import type { WvpStepImageExt } from "../step-image-media.js";

/** 章節 TSX 內嵌：依步驟副檔名組合配圖 URL */
export function buildCodegenStepImageBlock(
  wvpChapterId: string,
  extByStep: Record<number, WvpStepImageExt | string>,
): string {
  const normalized: Record<number, string> = {};
  for (const [k, v] of Object.entries(extByStep)) {
    normalized[Number(k)] = String(v).replace(/^\./, "").toLowerCase();
  }
  return `const WVP_ID = ${JSON.stringify(wvpChapterId)};
const STEP_IMAGE_EXT = ${JSON.stringify(normalized)} as Record<number, string>;
function stepImageUrl(step: number) {
  const ext = STEP_IMAGE_EXT[step] ?? "jpg";
  return \`\${import.meta.env.BASE_URL}images/\${WVP_ID}/\${String(step + 1).padStart(2, "0")}.\${ext}\`;
}
`;
}

/** 章節 TSX 內嵌：依步驟是否有動畫 HTML 檔組合動畫 URL */
export function buildCodegenStepAnimationBlock(
  wvpChapterId: string,
  animationStepIndices: number[],
): string {
  if (animationStepIndices.length === 0) return "";
  return `const STEP_ANIMATION_SET = new Set<number>(${JSON.stringify(animationStepIndices)});
function stepAnimationUrl(step: number) {
  return \`\${import.meta.env.BASE_URL}animations/\${WVP_ID}/\${String(step + 1).padStart(2, "0")}.html\`;
}
function hasStepAnimation(step: number) { return STEP_ANIMATION_SET.has(step); }
`;
}
