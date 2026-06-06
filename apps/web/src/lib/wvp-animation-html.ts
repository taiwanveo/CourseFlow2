/** 從 LLM 回應萃取可播放的 HTML，剝除 markdown 圍欄與前後贅文 */
export function normalizeAnimationHtml(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const cleaned = extractAnimationHtml(raw);
  return cleaned || null;
}

export function extractAnimationHtml(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  } else {
    text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  const doc =
    text.match(/<!DOCTYPE[\s\S]*?<\/html>/i)?.[0] ??
    text.match(/<html[\s\S]*?<\/html>/i)?.[0];
  return (doc ?? text).trim();
}

function visibleTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type AnimationHtmlIssue =
  | "markdown-leak"
  | "not-html"
  | "placeholder-text"
  | "too-simple"
  | "script-leak";

export function inspectAnimationHtml(
  html: string,
  opts?: { script?: string; screen?: string },
): AnimationHtmlIssue | null {
  if (!html.includes("<html")) return "not-html";
  if (/```/.test(html)) return "markdown-leak";

  const visible = visibleTextFromHtml(html);
  if (/感謝收看|謝謝觀看|谢谢观看|thank you for watching/i.test(visible)) {
    return "placeholder-text";
  }
  if (/(?:^|\s)[0-9]{1,2}(?:\s|$)/.test(visible) && visible.length <= 24) {
    return "placeholder-text";
  }

  const script = opts?.script?.trim() ?? "";
  if (script.length >= 10) {
    const head = script.slice(0, Math.min(24, script.length));
    if (html.includes(head)) return "script-leak";
    const first = script.split(/[。！？.!?]/)[0]?.trim() ?? "";
    if (first.length >= 8 && html.includes(first)) return "script-leak";
  }
  const screen = opts?.screen?.trim() ?? "";
  if (screen.length >= 6 && html.includes(screen)) return "script-leak";
  if (/\[(口播|畫面)\]/.test(html)) return "script-leak";

  const cjkRuns = visible.match(/[\u4e00-\u9fff]{8,}/g) ?? [];
  if (cjkRuns.some((run) => run.length >= 12)) return "script-leak";

  if (!animationHtmlMeetsQualityBar(html)) return "too-simple";
  return null;
}

/** 解說動畫最低品質：至少兩種動效手段 + 一種主視覺載體 */
export function animationHtmlMeetsQualityBar(html: string): boolean {
  if (html.length < 700) return false;

  const motionCount = [
    /@keyframes/i.test(html),
    /stroke-dashoffset|strokeDashoffset/i.test(html),
    /requestAnimationFrame/i.test(html),
    /animation:\s*[^;]{3,}/i.test(html),
    /transition:\s*[^;]{3,}/i.test(html),
    /setInterval|setTimeout/i.test(html),
  ].filter(Boolean).length;
  if (motionCount < 2) return false;

  const visualCount = [
    /<svg[\s>]/i.test(html),
    /<canvas[\s>]/i.test(html),
    /scaleX|scaleY|translate3d|rotate\(/i.test(html),
    /clip-path/i.test(html),
  ].filter(Boolean).length;
  if (visualCount < 1) return false;

  // 拒絕只有一兩條線、沒有分層結構的偷懶輸出
  const elementCount = (html.match(/<(div|svg|path|circle|rect|line|g|canvas)\b/gi) ?? []).length;
  if (elementCount < 4) return false;

  return true;
}

export function animationHtmlIssueMessage(issue: AnimationHtmlIssue): string {
  switch (issue) {
    case "markdown-leak":
      return "動畫含有 Markdown 標記（例如 ```html），請重試生成";
    case "not-html":
      return "AI 未能輸出完整 HTML 動畫，請重試";
    case "placeholder-text":
      return "動畫含有「感謝收看」或無關序號等佔位內容，請重試生成";
    case "too-simple":
      return "動畫過於簡陋（僅線條或靜態圖形），請重試生成更完整的解說動畫";
    case "script-leak":
      return "動畫把口播稿或內部標記放上畫面了，請重試生成（應為純圖形演示）";
    default:
      return "動畫品質未達標，請重試";
  }
}
