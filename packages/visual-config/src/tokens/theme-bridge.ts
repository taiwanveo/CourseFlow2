import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    text: string;
    muted: string;
  };
  font: { family: string; label: string };
  radius: number;
  spacing: number;
  motion: { duration: number; easing: string; stagger: number };
  moods: string[];
  darkMode: boolean;
}

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WVP_THEMES = join(
  PKG_ROOT,
  "..",
  "wvp-bridge",
  "vendor",
  "web-video-presentation",
  "themes",
);

function readCssVar(css: string, name: string, fallback: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m?.[1]?.trim() ?? fallback;
}

function parseDurationMs(raw: string, fallback: number): number {
  const n = parseInt(raw.replace(/ms$/, "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function tokensFromThemeCss(css: string, themeId: string): DesignTokens {
  const accent = readCssVar(css, "--accent", "#6366f1");
  const surface = readCssVar(css, "--surface", "#16162a");
  const text = readCssVar(css, "--text", "#e8e8f8");
  const muted = readCssVar(css, "--text-mute", "#8080aa");
  const body = readCssVar(css, "--font-body", "sans-serif");
  const dur = readCssVar(css, "--dur-base", "800ms");
  const shell = readCssVar(css, "--shell", "#0a0a0a");
  const darkMode = shell.startsWith("#0") || shell.startsWith("#1");

  return {
    colors: {
      primary: accent,
      secondary: readCssVar(css, "--accent-soft", accent),
      accent,
      surface,
      text,
      muted,
    },
    font: { family: body, label: themeId },
    radius: 8,
    spacing: 16,
    motion: {
      duration: parseDurationMs(dur, 800),
      easing: "cubic-bezier(0.22,1,0.36,1)",
      stagger: 80,
    },
    moods: ["專業正式"],
    darkMode,
  };
}

export async function loadDesignTokensForTheme(themeId: string): Promise<DesignTokens> {
  const path = join(WVP_THEMES, themeId, "tokens.css");
  try {
    const css = await readFile(path, "utf8");
    return tokensFromThemeCss(css, themeId);
  } catch {
    return tokensFromThemeCss("", themeId);
  }
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: "#6366f1",
    secondary: "#f59e0b",
    accent: "#10b981",
    surface: "#16162a",
    text: "#e8e8f8",
    muted: "#8080aa",
  },
  font: { family: "sans-serif", label: "通用" },
  radius: 10,
  spacing: 16,
  motion: { duration: 800, easing: "cubic-bezier(0.22,1,0.36,1)", stagger: 80 },
  moods: ["專業正式"],
  darkMode: true,
};
