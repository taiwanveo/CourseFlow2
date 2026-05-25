export interface ThemeMotionPreset {
  enterAnimationId: string;
  transitionId: string;
}

/** 各內建主題的建議進場／轉場（對齊 theme.json mood） */
const BY_THEME_ID: Record<string, ThemeMotionPreset> = {
  "midnight-press": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "paper-press": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "warm-keynote": { enterAnimationId: "scale-in", transitionId: "crossfade" },
  "newsroom": { enterAnimationId: "fade-in", transitionId: "crossfade" },
  "bauhaus-bold": { enterAnimationId: "fade-in", transitionId: "wipe-right" },
  "sunset-zine": { enterAnimationId: "scale-in", transitionId: "push-left" },
  "monochrome-print": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "terminal-green": { enterAnimationId: "fade-in", transitionId: "wipe-right" },
  "blueprint": { enterAnimationId: "slide-left", transitionId: "wipe-right" },
  "dark-botanical": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "neon-cyber": { enterAnimationId: "blur-in", transitionId: "cover" },
  "bold-signal": { enterAnimationId: "scale-in", transitionId: "cover" },
  "creative-voltage": { enterAnimationId: "scale-in", transitionId: "wipe-right" },
  "chalk-garden": { enterAnimationId: "blur-in", transitionId: "crossfade" },
  "vintage-editorial": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "pastel-dream": { enterAnimationId: "scale-in", transitionId: "crossfade" },
  "split-canvas": { enterAnimationId: "slide-left", transitionId: "push-left" },
  "electric-studio": { enterAnimationId: "fade-in", transitionId: "wipe-right" },
  "indigo-porcelain": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "forest-ink": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "kraft-paper": { enterAnimationId: "fade-up", transitionId: "crossfade" },
  dune: { enterAnimationId: "fade-up", transitionId: "crossfade" },
  "swiss-ikb": { enterAnimationId: "fade-in", transitionId: "wipe-right" },
};

export function resolveThemeMotion(themeId: string, mood: string[]): ThemeMotionPreset {
  const preset = BY_THEME_ID[themeId];
  if (preset) return preset;

  const tags = mood.map((m) => m.toLowerCase());
  if (tags.some((t) => ["quick", "snappy", "punchy", "bauhaus", "terminal", "linear"].includes(t))) {
    return { enterAnimationId: "fade-in", transitionId: "wipe-right" };
  }
  if (tags.some((t) => ["spring", "springy", "playful", "zine", "keynote"].includes(t))) {
    return { enterAnimationId: "scale-in", transitionId: "push-left" };
  }
  if (tags.some((t) => ["cyber", "futuristic", "neon"].includes(t))) {
    return { enterAnimationId: "blur-in", transitionId: "cover" };
  }
  if (tags.some((t) => ["blueprint", "technical", "engineering"].includes(t))) {
    return { enterAnimationId: "slide-left", transitionId: "wipe-right" };
  }
  if (tags.some((t) => ["cinematic", "slow", "editorial", "quiet", "museum", "print"].includes(t))) {
    return { enterAnimationId: "fade-up", transitionId: "crossfade" };
  }
  return { enterAnimationId: "fade-up", transitionId: "crossfade" };
}
