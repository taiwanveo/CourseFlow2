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
function hasStepImage(step: number) {
  return step in STEP_IMAGE_EXT;
}
function stepImageUrl(step: number) {
  const ext = STEP_IMAGE_EXT[step] ?? "jpg";
  return \`\${import.meta.env.BASE_URL}images/\${WVP_ID}/\${String(step + 1).padStart(2, "0")}.\${ext}\`;
}
/** Hook 多圖：僅在打包目錄確實有圖時才回傳 URL，避免預設 jpg 造成破圖 */
function resolveHookSlideUrl(slideIndex: number, checkpointUrl: string | null): string | null {
  if (checkpointUrl?.trim()) return checkpointUrl.trim();
  const wvpStep = slideIndex + 1;
  if (hasStepImage(wvpStep)) return stepImageUrl(wvpStep);
  if (slideIndex === 0 && hasStepImage(0)) return stepImageUrl(0);
  return null;
}
`;
}

type MotionConfigRecord = Record<string, unknown>;

/** 章節 TSX 內嵌：動畫步驟 + HTML 或 DSL Motion config（Phase 3 優先 config） */
export function buildCodegenStepAnimationBlock(
  wvpChapterId: string,
  animationStepIndices: number[],
  htmlByStep?: Partial<Record<number, string>>,
  configByStep?: Partial<Record<number, MotionConfigRecord>>,
): string {
  if (animationStepIndices.length === 0) return "";
  const inlineMap: Record<number, string> = {};
  const inlineConfig: Record<number, MotionConfigRecord> = {};
  for (const step of animationStepIndices) {
    const cfg = configByStep?.[step];
    if (cfg && typeof cfg.pattern === "string") {
      inlineConfig[step] = cfg;
      continue;
    }
    const html = htmlByStep?.[step]?.trim();
    if (html) inlineMap[step] = html;
  }
  const allIndices = [
    ...new Set([
      ...animationStepIndices,
      ...Object.keys(inlineMap).map(Number),
      ...Object.keys(inlineConfig).map(Number),
    ]),
  ].sort((a, b) => a - b);

  return `const STEP_ANIMATION_SET = new Set<number>(${JSON.stringify(allIndices)});
const STEP_ANIMATION_HTML: Partial<Record<number, string>> = ${JSON.stringify(inlineMap)};
const STEP_ANIMATION_CONFIG: Partial<Record<number, { pattern: string; params: Record<string, unknown>; version?: number }>> = ${JSON.stringify(inlineConfig)};
function stepAnimationUrl(step: number) {
  return \`\${import.meta.env.BASE_URL}animations/\${WVP_ID}/\${String(step + 1).padStart(2, "0")}.html\`;
}
function stepAnimationSrcDoc(step: number) {
  return STEP_ANIMATION_HTML?.[step] ?? undefined;
}
function stepAnimationConfig(step: number) {
  const c = STEP_ANIMATION_CONFIG?.[step];
  return c?.pattern ? c : undefined;
}
function hasStepAnimation(step: number) {
  return STEP_ANIMATION_SET.has(step) && (Boolean(stepAnimationConfig(step)) || Boolean(stepAnimationSrcDoc(step)));
}
`;
}
