export const SUBTITLE_FONT_OPTIONS = [
  { value: "Noto Sans TC", label: "Noto Sans TC（黑體）" },
  { value: "Noto Serif TC", label: "Noto Serif TC（明體）" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Microsoft JhengHei", label: "微軟正黑體" },
  { value: "PingFang TC", label: "蘋方-繁" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
] as const;

const SUBTITLE_FONT_SIZE_MIN = 16;
const SUBTITLE_FONT_SIZE_MID = 80;
const SUBTITLE_FONT_SIZE_MAX = 150;

export const SUBTITLE_FONT_SIZE_OPTIONS = [
  ...Array.from({ length: (SUBTITLE_FONT_SIZE_MID - SUBTITLE_FONT_SIZE_MIN) / 2 + 1 }, (_, index) =>
    SUBTITLE_FONT_SIZE_MIN + index * 2,
  ),
  ...Array.from({ length: (SUBTITLE_FONT_SIZE_MAX - 85) / 5 + 1 }, (_, index) => 85 + index * 5),
];

export function normalizeSubtitleFontSize(sizePx: number) {
  if (SUBTITLE_FONT_SIZE_OPTIONS.includes(sizePx)) return sizePx;

  const clamped = Math.min(SUBTITLE_FONT_SIZE_MAX, Math.max(SUBTITLE_FONT_SIZE_MIN, sizePx));
  if (clamped <= SUBTITLE_FONT_SIZE_MID) {
    const rounded = Math.round(clamped / 2) * 2;
    return Math.min(SUBTITLE_FONT_SIZE_MID, Math.max(SUBTITLE_FONT_SIZE_MIN, rounded));
  }

  const rounded = Math.round(clamped / 5) * 5;
  return Math.min(SUBTITLE_FONT_SIZE_MAX, Math.max(85, rounded));
}

export function resolveSubtitleFontFamily(fontFamily: string) {
  const known = SUBTITLE_FONT_OPTIONS.some((option) => option.value === fontFamily);
  return known ? fontFamily : SUBTITLE_FONT_OPTIONS[0].value;
}
