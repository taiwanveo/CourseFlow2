import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface WvpThemeMeta {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  mood: string[];
  bestFor: string[];
  preview: {
    shell: string;
    surface: string;
    text: string;
    accent: string;
  };
}

export function themesDir(): string {
  const candidates = [
    join(__dirname, "..", "vendor", "web-video-presentation", "themes"),
    join(__dirname, "..", "dist", "themes"),
    join(__dirname, "..", "..", "..", "skills", "web-video-presentation", "themes"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]!;
}

export function listThemes(): WvpThemeMeta[] {
  const dir = themesDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const jsonPath = join(dir, d.name, "theme.json");
      if (!existsSync(jsonPath)) return null;
      return JSON.parse(readFileSync(jsonPath, "utf8")) as WvpThemeMeta;
    })
    .filter((t): t is WvpThemeMeta => t !== null);
}

export function getThemeTokensCss(themeId: string): string | null {
  const path = join(themesDir(), themeId, "tokens.css");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function recommendThemes(keywords: string[], limit = 3): WvpThemeMeta[] {
  const themes = listThemes();
  const scored = themes.map((t) => {
    const hay = [t.descriptionZh, t.description, ...t.bestFor, ...t.mood, t.nameZh]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (hay.includes(kw.toLowerCase())) score += 2;
    }
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.t);
}
