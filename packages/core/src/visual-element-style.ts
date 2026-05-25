import type { TextVisualElement } from "./composition.js";
import { hexToRgba } from "./subtitle-style.js";

export const VISUAL_TEXT_PADDING_PX = 8;

/** 舞台尺寸（與 CourseComposition.meta 預設一致） */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/** 內容文字方塊預設：貼齊上緣、高度為畫面 2/3、左右留白 */
export const DEFAULT_TEXT_BOX_SIDE_MARGIN = 160;
export const DEFAULT_TEXT_BOX_Y = 0;
export const DEFAULT_TEXT_BOX_WIDTH = STAGE_WIDTH - DEFAULT_TEXT_BOX_SIDE_MARGIN * 2;
export const DEFAULT_TEXT_BOX_HEIGHT = Math.round(STAGE_HEIGHT * (2 / 3));

export function defaultContentTextBoxRect(): Pick<
  TextVisualElement,
  "x" | "y" | "width" | "height"
> {
  return {
    x: DEFAULT_TEXT_BOX_SIDE_MARGIN,
    y: DEFAULT_TEXT_BOX_Y,
    width: DEFAULT_TEXT_BOX_WIDTH,
    height: DEFAULT_TEXT_BOX_HEIGHT,
  };
}

/** 預設額外行距（px），實際行高 = 字級 + 此行距（當 lineHeightPx 小於字級時） */
export const DEFAULT_TEXT_LINE_SPACING_PX = 10;

export function resolveTextLineHeightPx(el: TextVisualElement): number {
  const raw = el.lineHeightPx ?? DEFAULT_TEXT_LINE_SPACING_PX;
  if (raw >= el.fontSizePx) return raw;
  return el.fontSizePx + raw;
}

/** 方塊內垂直置中；水平對齊由 textAlign / Konva align 控制 */
export function visualTextVerticalAlign(
  _el: TextVisualElement,
): "top" | "middle" {
  return "middle";
}

export function visualTextFlexAlignItems(
  _el: TextVisualElement,
): "flex-start" | "center" {
  return "center";
}

export function konvaTextLineHeight(el: TextVisualElement): number {
  return resolveTextLineHeightPx(el) / Math.max(1, el.fontSizePx);
}

export function visualTextBackgroundRgba(el: TextVisualElement): string | null {
  if (el.backgroundOpacity <= 0) return null;
  return hexToRgba(el.backgroundColor || "#000000", el.backgroundOpacity);
}

export function flexJustifyForTextAlign(
  align: TextVisualElement["textAlign"],
): "flex-start" | "center" | "flex-end" {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/** 播放器 DOM 文字方塊樣式（與 Konva 編輯器對齊） */
export function visualTextClassName(isHero: boolean, themeActive: boolean): string {
  if (!themeActive) return "visual-text";
  return isHero ? "visual-text hero-num serif-cn" : "visual-text";
}

export function visualTextBoxDomStyle(
  el: TextVisualElement,
  options?: { themeActive?: boolean },
): Record<string, string | number> {
  const bg = visualTextBackgroundRgba(el);
  const themeActive = options?.themeActive ?? false;
  const style: Record<string, string | number> = {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    textAlign: el.textAlign,
    zIndex: el.zIndex,
    padding: VISUAL_TEXT_PADDING_PX,
    boxSizing: "border-box",
    display: "flex",
    alignItems: visualTextFlexAlignItems(el),
    justifyContent: flexJustifyForTextAlign(el.textAlign),
    lineHeight: `${resolveTextLineHeightPx(el)}px`,
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  if (!themeActive) {
    style.fontFamily = el.fontFamily;
    style.fontSize = el.fontSizePx;
    style.color = el.color;
    style.backgroundColor = bg ?? "transparent";
  } else {
    style.fontSize = el.fontSizePx;
    if (bg) style.backgroundColor = bg;
  }

  return style;
}

/** 獨立調整文字方塊寬高（字級不變） */
export function resizeTextElementBox(
  el: TextVisualElement,
  scaleX: number,
  scaleY: number,
): Pick<TextVisualElement, "width" | "height"> {
  return {
    width: Math.max(80, Math.round(el.width * Math.max(0.05, scaleX))),
    height: Math.max(40, Math.round(el.height * Math.max(0.05, scaleY))),
  };
}

/** 獨立調整圖片寬高 */
export function resizeImageElementBox(
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  return {
    width: Math.max(40, Math.round(width * Math.max(0.05, scaleX))),
    height: Math.max(40, Math.round(height * Math.max(0.05, scaleY))),
  };
}

/** 等比縮放文字方塊（寬高與字級同比例） */
export function scaleTextElementUniform(
  el: TextVisualElement,
  scale: number,
): Pick<TextVisualElement, "width" | "height" | "fontSizePx" | "lineHeightPx"> {
  const s = Math.max(0.05, scale);
  const rawLh = el.lineHeightPx ?? DEFAULT_TEXT_LINE_SPACING_PX;
  return {
    width: Math.max(80, Math.round(el.width * s)),
    height: Math.max(40, Math.round(el.height * s)),
    fontSizePx: Math.max(12, Math.round(el.fontSizePx * s)),
    lineHeightPx:
      rawLh >= el.fontSizePx
        ? Math.max(12, Math.round(rawLh * s))
        : Math.max(4, Math.round(rawLh * s)),
  };
}

/** 等比縮放圖片元素 */
export function scaleImageElementUniform(
  width: number,
  height: number,
  scale: number,
  aspectRatio: number,
): { width: number; height: number } {
  const s = Math.max(0.05, scale);
  const newWidth = Math.max(40, Math.round(width * s));
  return {
    width: newWidth,
    height: Math.max(40, Math.round(newWidth / aspectRatio)),
  };
}

export function resolveSubtitleDisplayText(
  segments: { text: string }[] | undefined,
  fallbackScript: string,
): string {
  if (segments?.length) {
    const joined = segments.map((s) => s.text).join("");
    if (joined.trim()) return joined;
  }
  return fallbackScript.trim();
}
