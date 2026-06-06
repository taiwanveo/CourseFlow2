import { esc } from "./shared.js";

export type RenderTheme = {
  bg: string;
  surface: string;
  text: string;
  textMute: string;
  accent: string;
  accentSoft: string;
  fontBody: string;
  durBase: string;
};

const DEFAULT_THEME: RenderTheme = {
  bg: "#0d0b09",
  surface: "#1a1714",
  text: "#f5f0e5",
  textMute: "#7a7972",
  accent: "#ff4a2b",
  accentSoft: "rgba(255,74,43,0.14)",
  fontBody: `"PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif`,
  durBase: "700ms",
};

export function themeFromId(themeId?: string): RenderTheme {
  // 簡化：深色主題用 accent 橙、淺色主題用綠／藍
  const light = /warm|paper|dune|pastel|kraft|swiss|electric-studio|forest|indigo|vintage|newsroom|bauhaus|monochrome|split|sunset/.test(
    themeId ?? "",
  );
  if (light) {
    return {
      bg: "linear-gradient(135deg,#f5f7fa 0%,#e8ecf3 100%)",
      surface: "#ffffff",
      text: "#2c3e50",
      textMute: "#7f8c8d",
      accent: "#27ae60",
      accentSoft: "rgba(39,174,96,0.12)",
      fontBody: DEFAULT_THEME.fontBody,
      durBase: "600ms",
    };
  }
  return DEFAULT_THEME;
}

export function wrapExplainHtml(parts: {
  title: string;
  subtitle: string;
  svg: string;
  script: string;
  theme?: RenderTheme;
}): string {
  const t = parts.theme ?? DEFAULT_THEME;
  const bgCss = t.bg.startsWith("linear") ? t.bg : t.bg;
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(parts.title)}</title>
<style>
  :root{
    --bg:${bgCss};
    --surface:${t.surface};
    --text:${t.text};
    --text-mute:${t.textMute};
    --accent:${t.accent};
    --accent-soft:${t.accentSoft};
    --font:${t.fontBody};
    --dur:${t.durBase};
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden;
    background:var(--bg);color:var(--text);font-family:var(--font);
    display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .scene{background:var(--surface);border-radius:16px;padding:24px 16px 16px;
    box-shadow:0 10px 40px rgba(0,0,0,0.12);max-width:min(92vw,640px);width:100%}
  svg{width:100%;height:auto;display:block}
  .status{text-align:center;margin-top:12px;font-size:13px;color:var(--text-mute);min-height:18px}
</style>
</head>
<body>
  <div class="scene">
    ${parts.svg}
    <div class="status" id="status"></div>
  </div>
<script>
window.addEventListener('DOMContentLoaded',function(){
  ${parts.script}
});
</script>
</body>
</html>`;
}
