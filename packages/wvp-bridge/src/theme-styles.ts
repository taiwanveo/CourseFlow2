import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ThemeTokenSnapshot } from "@courseflow/core";
import {
  buildResolvedThemeTokens,
  parseCssCustomProperties,
} from "./parse-theme-tokens.js";
import { getThemeTokensCss, type WvpThemeMeta } from "./themes-fs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return null;
}

/** web-video-presentation base.css（stage-frame 裝飾、primitive class） */
export function getThemeBaseCss(): string {
  return (
    readFirstExisting([
      join(__dirname, "..", "dist", "theme-base.css"),
      join(
        __dirname,
        "..",
        "vendor",
        "web-video-presentation",
        "templates",
        "src",
        "styles",
        "base.css",
      ),
      join(
        __dirname,
        "..",
        "..",
        "..",
        "skills",
        "web-video-presentation",
        "templates",
        "src",
        "styles",
        "base.css",
      ),
    ]) ?? ""
  );
}

/** Google Fonts 載入（主題字型顯示必要） */
export function getThemeFontsCss(): string {
  return (
    readFirstExisting([
      join(__dirname, "..", "dist", "theme-fonts.css"),
      join(
        __dirname,
        "..",
        "vendor",
        "web-video-presentation",
        "templates",
        "src",
        "styles",
        "fonts.css",
      ),
      join(
        __dirname,
        "..",
        "..",
        "..",
        "skills",
        "web-video-presentation",
        "templates",
        "src",
        "styles",
        "fonts.css",
      ),
    ]) ?? ""
  );
}

export function buildThemeStylesCss(themeId: string): string | null {
  const tokensCss = getThemeTokensCss(themeId);
  if (!tokensCss) return null;
  const fontsCss = getThemeFontsCss();
  const baseCss = getThemeBaseCss();
  return `${fontsCss}\n\n${baseCss}\n\n/* ── theme: ${themeId} ── */\n${tokensCss}`;
}

/** 合併 base.css + tokens.css 的 :root 變數（tokens 覆蓋 base） */
export function mergeThemeTokenMaps(tokensCss: string): Record<string, string> {
  const base = parseCssCustomProperties(getThemeBaseCss());
  const theme = parseCssCustomProperties(tokensCss);
  return { ...base, ...theme };
}

export interface ThemeBundle {
  meta: WvpThemeMeta;
  tokensCss: string;
  stylesCss: string;
  resolved: ThemeTokenSnapshot;
}

export function getThemeBundle(meta: WvpThemeMeta): ThemeBundle | null {
  const tokensCss = getThemeTokensCss(meta.id);
  if (!tokensCss) return null;
  const merged = mergeThemeTokenMaps(tokensCss);
  return {
    meta,
    tokensCss,
    stylesCss: buildThemeStylesCss(meta.id) ?? tokensCss,
    resolved: buildResolvedThemeTokens(merged),
  };
}
