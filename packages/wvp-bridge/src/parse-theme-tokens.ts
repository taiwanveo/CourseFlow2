/** 從 CSS 字串解析 :root 區塊內的自訂屬性 */
export function parseCssCustomProperties(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const blocks = css.match(/:root\s*\{([^}]*)\}/gs) ?? [];
  for (const block of blocks) {
    const inner = block.replace(/^:root\s*\{|\}$/g, "");
    for (const match of inner.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      tokens[match[1]!] = match[2]!.trim();
    }
  }
  return tokens;
}

/** 解析 var(--x, fallback) 鏈，回傳最終字面值 */
export function resolveCssToken(
  tokens: Record<string, string>,
  key: string,
  depth = 0,
): string {
  if (depth > 12) return tokens[key]?.trim() ?? "";
  const raw = tokens[key]?.trim();
  if (!raw) return "";

  const varMatch = raw.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
  if (varMatch) {
    const resolved = resolveCssToken(tokens, varMatch[1]!, depth + 1);
    if (resolved) return resolved;
    const fallback = varMatch[2]?.trim() ?? "";
    if (fallback.startsWith("var(")) return resolveCssToken(tokens, fallback, depth + 1);
    return fallback.replace(/^["']|["']$/g, "");
  }

  return raw;
}

/** 取字型 token 的第一個 font-family 名稱（Konva / inline 用） */
export function primaryFontFamily(tokenValue: string): string {
  const cleaned = tokenValue.replace(/^["']|["']$/g, "").trim();
  const first = cleaned.split(",")[0]?.trim() ?? cleaned;
  return first.replace(/^["']|["']$/g, "");
}

export interface ResolvedThemeTokens {
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

export function buildResolvedThemeTokens(
  merged: Record<string, string>,
): import("@courseflow/core").ThemeTokenSnapshot {
  return {
    shell: resolveCssToken(merged, "--shell"),
    surface: resolveCssToken(merged, "--surface"),
    surface2: resolveCssToken(merged, "--surface-2"),
    text: resolveCssToken(merged, "--text"),
    textMute: resolveCssToken(merged, "--text-mute"),
    accent: resolveCssToken(merged, "--accent"),
    fontDisplayCn: primaryFontFamily(resolveCssToken(merged, "--font-display-cn")),
    fontDisplayEn: primaryFontFamily(resolveCssToken(merged, "--font-display-en")),
    fontBody: primaryFontFamily(resolveCssToken(merged, "--font-body")),
    fontMono: primaryFontFamily(resolveCssToken(merged, "--font-mono")),
    heroNumFont: primaryFontFamily(resolveCssToken(merged, "--hero-num-font")),
    heroNumWeight: resolveCssToken(merged, "--hero-num-weight"),
    heroNumStyle: resolveCssToken(merged, "--hero-num-style"),
    stagePadX: resolveCssToken(merged, "--stage-pad-x"),
    stagePadY: resolveCssToken(merged, "--stage-pad-y"),
    ruleWidth: resolveCssToken(merged, "--rule-w"),
    cardRadius: resolveCssToken(merged, "--r-card"),
  };
}
