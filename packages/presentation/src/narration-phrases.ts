/** 將口播切成 2–4 句，供畫面逐句揭示（內容即視覺） */
export function splitNarrationPhrases(text: string, max = 4): string[] {
  const t = text.trim();
  if (!t) return [];

  let parts = t
    .split(/(?<=[。！？!?；;])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  if (parts.length <= 1 && t.length > 64) {
    const chunk = 36;
    parts = [];
    for (let i = 0; i < t.length && parts.length < max; i += chunk) {
      parts.push(t.slice(i, i + chunk).trim());
    }
  }

  return parts.slice(0, max).map((p) => (p.length > 88 ? `${p.slice(0, 86)}…` : p));
}
