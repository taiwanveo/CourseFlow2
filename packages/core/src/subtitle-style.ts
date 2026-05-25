import type { SubtitlePosition, SubtitleStyle } from "./composition.js";
import { DEFAULT_SUBTITLE_POSITION, DEFAULT_SUBTITLE_STYLE } from "./composition.js";

export const SUBTITLE_CANVAS_W = 1920;
export const SUBTITLE_CANVAS_H = 1080;

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function subtitleBackgroundColor(
  style: Pick<SubtitleStyle, "backgroundColor" | "backgroundOpacity">,
): string {
  return hexToRgba(style.backgroundColor, style.backgroundOpacity);
}

export function resolveSubtitleStyle(style?: SubtitleStyle): SubtitleStyle {
  return style ? { ...DEFAULT_SUBTITLE_STYLE, ...style } : { ...DEFAULT_SUBTITLE_STYLE };
}

export function resolveSubtitlePosition(position?: Partial<SubtitlePosition>): SubtitlePosition {
  return position ? { ...DEFAULT_SUBTITLE_POSITION, ...position } : { ...DEFAULT_SUBTITLE_POSITION };
}

export type SubtitleOverlayCss = {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  minHeight: number;
  boxSizing: "border-box";
  borderRadius: number;
  padding: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  WebkitTextStroke: string;
  backgroundColor: string;
};

export function buildSubtitleOverlayStyle(
  style: SubtitleStyle,
  position?: Partial<SubtitlePosition>,
  scale = 1,
): SubtitleOverlayCss {
  const resolvedStyle = resolveSubtitleStyle(style);
  const pos = resolveSubtitlePosition(position);
  const s = scale;
  return {
    position: "absolute",
    left: pos.x * s,
    top: pos.y * s,
    width: pos.width * s,
    minHeight: pos.height * s,
    boxSizing: "border-box",
    borderRadius: 4 * s,
    padding: `${4 * s}px ${8 * s}px`,
    fontFamily: resolvedStyle.fontFamily,
    fontSize: resolvedStyle.fontSizePx * s,
    color: resolvedStyle.color,
    WebkitTextStroke: `1px ${resolvedStyle.strokeColor}`,
    backgroundColor: subtitleBackgroundColor(resolvedStyle),
  };
}

export function subtitleOverlayInlineCss(
  style: SubtitleStyle,
  position?: Partial<SubtitlePosition>,
): string {
  const resolvedStyle = resolveSubtitleStyle(style);
  const pos = resolveSubtitlePosition(position);
  const bg = subtitleBackgroundColor(resolvedStyle);
  return [
    "position:absolute",
    `left:${pos.x}px`,
    `top:${pos.y}px`,
    `width:${pos.width}px`,
    `min-height:${pos.height}px`,
    "box-sizing:border-box",
    "border-radius:4px",
    "padding:4px 8px",
    `font-family:${resolvedStyle.fontFamily}`,
    `font-size:${resolvedStyle.fontSizePx}px`,
    `color:${resolvedStyle.color}`,
    `-webkit-text-stroke:1px ${resolvedStyle.strokeColor}`,
    `background-color:${bg}`,
    "z-index:100",
  ].join(";");
}
