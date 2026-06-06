import type { VisualConfig } from "./schema/visual.js";

const NARRATION_LEAK_RE =
  /第一步|第二步|第三步|假設|百分之|接下來|首先|口播|看完成率|資料顯示|本步口播/i;

/** 判斷字串是否像口播稿洩漏到畫面上（而非短標語） */
export function looksLikeNarrationLeak(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 48) return true;
  if (NARRATION_LEAK_RE.test(t)) return true;
  return false;
}

function screenPhrase(screen?: string, max = 72): string {
  return screen?.trim().slice(0, max) ?? "";
}

function stripBadAxisLabel(value: string, index: number): string {
  const v = value.trim();
  if (!v || /口播|narration/i.test(v) || looksLikeNarrationLeak(v)) {
    return `第${index + 1}週`;
  }
  return v;
}

/**
 * 生成後清理 VisualConfig：避免口播稿出現在 subtitle / callout / 圖表軸標籤，
 * 並清除 process-flow 的 emphasis（高亮改由播放步驟 runtime 決定）。
 */
export function sanitizeVisualConfig(
  config: VisualConfig,
  opts: { screenContent?: string; stepScript?: string },
): VisualConfig {
  const screen = screenPhrase(opts.screenContent);
  const script = opts.stepScript?.trim() ?? "";

  if (config.kind === "chart") {
    let next = { ...config };
    if (next.subtitle && looksLikeNarrationLeak(next.subtitle)) {
      const { subtitle: _s, ...rest } = next;
      next = rest;
    }
    if (looksLikeNarrationLeak(next.title) && screen) {
      next = { ...next, title: screen.slice(0, 32) };
    }
    next = {
      ...next,
      data: next.data.map((row, i) => {
        const r = { ...row };
        const raw = r[next.xKey];
        if (typeof raw === "string") {
          r[next.xKey] = stripBadAxisLabel(raw, i);
        }
        return r;
      }),
    };
    return next;
  }

  if (config.kind === "animation") {
    const items = config.items.map((item) => {
      let text = item.text;
      const overlapsScript =
        script.length >= 16 && text.length >= 12 && script.includes(text.slice(0, 12));
      if (looksLikeNarrationLeak(text) || overlapsScript) {
        text = screen || config.title.slice(0, 32) || "重點";
      }
      return { ...item, text, emphasis: false };
    });
    let title = config.title;
    if (looksLikeNarrationLeak(title) && screen) {
      title = screen.slice(0, 32);
    }
    return { ...config, title, items };
  }

  return config;
}
