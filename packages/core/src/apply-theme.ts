import type { CourseComposition } from "./composition.js";

/** 主題 CSS token 快照（由伺服器從 tokens.css 解析） */
export interface ThemeTokenSnapshot {
  shell: string;
  surface: string;
  surface2: string;
  text: string;
  textMute: string;
  accent: string;
  fontDisplayCn: string;
  fontDisplayEn: string;
  fontBody: string;
  fontMono: string;
  heroNumFont: string;
  heroNumWeight: string;
  heroNumStyle: string;
  stagePadX: string;
  stagePadY: string;
  ruleWidth: string;
  cardRadius: string;
}

export interface ThemeApplyMeta {
  id: string;
  nameZh: string;
  mood?: string[];
  enterAnimationId: string;
  transitionId: string;
  resolved: ThemeTokenSnapshot;
}

/** 將主題 token 套用到 composition（背景、字型、文字色、字幕） */
export function applyThemeToComposition(
  composition: CourseComposition,
  theme: ThemeApplyMeta | null,
): CourseComposition {
  if (!theme) {
    return { ...composition, meta: { ...composition.meta, themeId: null } };
  }

  const t = theme.resolved;
  const enterAnimationId = theme.enterAnimationId;
  const transitionId = theme.transitionId;

  return {
    ...composition,
    meta: { ...composition.meta, themeId: theme.id },
    visuals: composition.visuals.map((visual) => ({
      ...visual,
      enterAnimationId,
      transitionId,
      background:
        visual.background.type === "image" && visual.background.publicUrl
          ? visual.background
          : {
              type: "color" as const,
              color: t.surface,
              opacity: visual.background.opacity ?? 1,
            },
      elements: visual.elements.map((el) => {
        if (el.type !== "text") return el;
        const isHero = el.id.endsWith("-hero");
        return {
          ...el,
          fontFamily: isHero ? t.fontDisplayCn : t.fontBody,
          color: t.text,
          backgroundColor: isHero ? "transparent" : t.surface2,
          backgroundOpacity: isHero ? 0 : Math.min(el.backgroundOpacity, 0.12),
        };
      }),
    })),
    subtitles: composition.subtitles.map((sub) => ({
      ...sub,
      style: {
        ...sub.style,
        color: t.text,
        fontFamily: t.fontBody,
        strokeColor: t.shell,
        backgroundColor: t.surface2,
      },
    })),
  };
}
