import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** monorepo 根目錄（packages/presentation/dist → ../../..） */
export const MONOREPO_ROOT = join(PKG_DIR, "..", "..");

export const WVP_VENDOR_ROOT = join(
  MONOREPO_ROOT,
  "packages",
  "wvp-bridge",
  "vendor",
  "web-video-presentation",
);

export const WVP_TEMPLATES_DIR = join(WVP_VENDOR_ROOT, "templates");
export const WVP_THEMES_DIR = join(WVP_VENDOR_ROOT, "themes");

export function themeTokensPath(themeId: string): string {
  return join(WVP_THEMES_DIR, themeId, "tokens.css");
}
