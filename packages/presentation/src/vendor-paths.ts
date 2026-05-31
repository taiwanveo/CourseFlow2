import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** monorepo 根目錄（packages/presentation/dist → ../../..） */
export const MONOREPO_ROOT = join(PKG_DIR, "..", "..");

/**
 * WVP vendor 原始模板根目錄。
 *
 * 你未來如果在找「CourseFlow 複製模板時到底是從哪個資料夾拿檔案」，就是這裡。
 */
export const WVP_VENDOR_ROOT = join(
  MONOREPO_ROOT,
  "packages",
  "wvp-bridge",
  "vendor",
  "web-video-presentation",
);

export const WVP_TEMPLATES_DIR = join(WVP_VENDOR_ROOT, "templates");
export const WVP_THEMES_DIR = join(WVP_VENDOR_ROOT, "themes");

/**
 * 每個 theme 的 token CSS 位置。
 *
 * theme token 主要控制：顏色、字體、舞台 padding、radius、陰影、動畫節奏。
 * 章節內更細的標題位置 / 字級 / 版型欄寬，則通常不在這裡，而是在 component CSS。
 */
export function themeTokensPath(themeId: string): string {
  return join(WVP_THEMES_DIR, themeId, "tokens.css");
}
