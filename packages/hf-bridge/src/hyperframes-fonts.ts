import {
  getThemeBaseCss,
  getThemeTokensCss,
} from "@courseflow/wvp-bridge";

/**
 * HyperFrames 可自動嵌入的 canonical 字型名稱（見 hyperframes deterministicFonts）。
 * 匯出時將所有 font-family 收斂到此清單，避免離線渲染去抓 Google Fonts 而卡住。
 */
const HF_CANONICAL = new Set([
  "inter",
  "montserrat",
  "outfit",
  "nunito",
  "oswald",
  "league-gothic",
  "archivo-black",
  "space-mono",
  "ibm-plex-mono",
  "jetbrains-mono",
  "eb-garamond",
  "playfair-display",
  "source-code-pro",
  "noto-sans-jp",
  "roboto",
  "open-sans",
  "lato",
  "poppins",
]);

const FONT_ALIASES: Record<string, string> = {
  inter: "inter",
  "helvetica neue": "inter",
  helvetica: "inter",
  arial: "inter",
  "segoe ui": "roboto",
  montserrat: "montserrat",
  futura: "montserrat",
  outfit: "outfit",
  nunito: "nunito",
  oswald: "oswald",
  "bebas neue": "league-gothic",
  "league gothic": "league-gothic",
  "archivo black": "archivo-black",
  "space mono": "space-mono",
  "ibm plex mono": "ibm-plex-mono",
  "jetbrains mono": "jetbrains-mono",
  "sf mono": "jetbrains-mono",
  "courier new": "jetbrains-mono",
  courier: "jetbrains-mono",
  "source code pro": "source-code-pro",
  "eb garamond": "eb-garamond",
  garamond: "eb-garamond",
  "playfair display": "playfair-display",
  roboto: "roboto",
  "open sans": "open-sans",
  lato: "lato",
  poppins: "poppins",
  "noto sans jp": "noto-sans-jp",
  "noto sans japanese": "noto-sans-jp",
  "noto sans tc": "noto-sans-jp",
  "noto sans cjk": "noto-sans-jp",
  "noto sans mono cjk sc": "jetbrains-mono",
  "noto serif tc": "noto-sans-jp",
  "microsoft jhenghei": "noto-sans-jp",
  "pingfang tc": "noto-sans-jp",
  "pingfang sc": "noto-sans-jp",
  "dm sans": "inter",
  "clash display": "montserrat",
  satoshi: "outfit",
  "instrument serif": "playfair-display",
  fraunces: "eb-garamond",
  "source serif 4": "eb-garamond",
  "noto serif sc": "noto-sans-jp",
  manrope: "outfit",
  "noto sans sc": "noto-sans-jp",
  "ibm plex sans": "inter",
  "patrick hand": "nunito",
  georgia: "eb-garamond",
  "times new roman": "eb-garamond",
  systemui: "inter",
  "system-ui": "inter",
};

function firstFamilyInStack(stack: string): string {
  const trimmed = stack.trim();
  const quoted = trimmed.match(/^['"]([^'"]+)['"]/);
  if (quoted) return quoted[1]!.trim();
  const bare = trimmed.split(",")[0]?.trim() ?? trimmed;
  return bare.replace(/^['"]|['"]$/g, "").trim();
}

export function toHyperframesFontFamily(fontFamily: string): string {
  const primary = firstFamilyInStack(fontFamily);
  const key = primary.toLowerCase();
  if (HF_CANONICAL.has(key)) return key;
  const mapped = FONT_ALIASES[key];
  if (mapped) return mapped;
  return "noto-sans-jp";
}

export function rewriteCssForHyperframes(css: string): string {
  let out = css.replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\)\s*;?/gi, "");
  out = out.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");

  out = out.replace(
    /(--[a-z0-9-]*font[a-z0-9-]*)\s*:\s*([^;]+);/gi,
    (_, prop: string, stack: string) => {
      const mapped = toHyperframesFontFamily(stack);
      const generic = mapped.includes("mono") ? "monospace" : "sans-serif";
      return `${prop}: ${mapped}, ${generic};`;
    },
  );

  return out.replace(
    /font-family\s*:\s*([^;}{]+)/gi,
    (match, stack: string) => {
      if (stack.includes("var(--")) return match;
      const mapped = toHyperframesFontFamily(stack);
      const generic = mapped.includes("mono") ? "monospace" : "sans-serif";
      return `font-family: ${mapped}, ${generic}`;
    },
  );
}

/** 匯出用主題樣式：不含 Google Fonts @import，字型名稱已對齊 HyperFrames */
export function buildThemeStylesCssForRender(themeId: string): string | null {
  const tokensCss = getThemeTokensCss(themeId);
  if (!tokensCss) return null;
  const baseCss = getThemeBaseCss();
  return rewriteCssForHyperframes(`${baseCss}\n\n/* theme: ${themeId} */\n${tokensCss}`);
}
