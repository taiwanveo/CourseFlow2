import type { ExplainAnimationConfig } from "../schema.js";
import { renderScene } from "./engines.js";
import { themeFromId, wrapExplainHtml } from "./shell.js";

export type RenderExplainOptions = {
  themeId?: string;
};

/** 將 DSL config 渲染為可嵌入 iframe 的完整 HTML */
export function renderExplainAnimationHtml(
  config: ExplainAnimationConfig,
  options: RenderExplainOptions = {},
): string {
  const scene = renderScene(config);
  const theme = themeFromId(options.themeId);
  return wrapExplainHtml({
    title: scene.title,
    subtitle: scene.subtitle,
    svg: scene.svg,
    script: scene.script,
    theme,
  });
}

export { renderScene } from "./engines.js";
export { wrapExplainHtml, themeFromId } from "./shell.js";
