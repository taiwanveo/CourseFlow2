import { getThemeTokensCss } from "./themes-fs.js";
import { getThemeFontsCss } from "./theme-styles.js";

/**
 * 編輯器內主題預覽用 CSS（不含 base.css 全域 reset）。
 * 避免 html/body { overflow: hidden } 導致 CourseFlow 管理頁無法捲動。
 */
const SCOPED_STAGE_CHROME = `
.cf-theme-preview-host.app-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: var(--shell);
  padding: 12px 0;
}
.cf-theme-preview-host .stage-fitter {
  position: relative;
  isolation: isolate;
}
.cf-theme-preview-host .stage-frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow-stage);
  border: var(--stage-border, none);
  border-radius: var(--r-stage, 0);
}
.cf-theme-preview-host .stage-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: var(--surface-pattern, none);
  background-size: var(--surface-pattern-size, auto);
  mix-blend-mode: var(--surface-pattern-blend, normal);
  opacity: var(--surface-pattern-opacity, 1);
  z-index: 1;
}
.cf-theme-preview-host .stage-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--surface-vignette, none);
  z-index: 1;
}
.cf-theme-preview-host .hero-num {
  font-family: var(--hero-num-font);
  font-style: var(--hero-num-style);
  font-weight: var(--hero-num-weight);
  letter-spacing: var(--hero-num-track);
  color: var(--text);
}
.cf-theme-preview-host .serif-cn {
  font-family: var(--font-display-cn);
  font-weight: 700;
  color: var(--text);
}
`;

export function buildThemeEditorPreviewCss(themeId: string): string | null {
  const tokensCss = getThemeTokensCss(themeId);
  if (!tokensCss) return null;
  const fontsCss = getThemeFontsCss();
  return `${fontsCss}\n\n${tokensCss}\n\n${SCOPED_STAGE_CHROME}`;
}
