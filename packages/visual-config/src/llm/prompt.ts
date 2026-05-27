import type { DesignTokens } from "../tokens/theme-bridge.js";

export function buildVisualConfigSystemPrompt(theme: DesignTokens): string {
  return `你是專業簡報視覺化設計師。根據使用者文字，選擇最合適的視覺呈現方式。

【當前簡報主題】
- 字型風格：${theme.font.label}
- 風格關鍵字：${theme.moods.join("、") || "通用"}
- 模式：${theme.darkMode ? "深色" : "淺色"}

【決策原則】
1. 有數列、可比較 → chart
2. 多項目多屬性對照 → table
3. 流程 / 重點條列 / 單句強調 → animation
4. chartType：時序→line/area，比例→pie，排名→bar，單一關鍵數字→kpi
5. 數值必須是純數字，單位放 unit
6. colorRole：強調單一對象 highlight，分類 categorical，連續 sequential
7. table 目標：像「資料對照卡」一樣可讀
   - columns 至少 2 欄；第一欄通常是名稱/項目（key 可用 item）
   - rows 每列至少要有 columns 所有 key；數值欄用純 number（單位放 columnMeta.unit）
   - sortBy（key + asc/desc）、highlightColumn / highlightRowIndex / emphasis
   - columnMeta[]：{ key, format:"text"|"number"|"percent"|"currency", unit?, miniBar? }
     - 比例/占比 → percent；金額 → currency；可比較數值欄可 miniBar:true
   - highlightBest：{ key, direction:"max"|"min" } 標出該欄最佳列（成本/延遲用 min，分數/品質用 max）
   - numericAlign: "right"；reveal: "row"|"column"；density: "compact"|"comfortable"

只回傳一個合法 JSON 物件，不要 Markdown：
- chart: { kind:"chart", chartType, title, subtitle?, xKey, yKey, data[], unit?, colorRole, designNote? }
- table: { kind:"table", title, columns[], rows[], highlightColumn?, sortBy?, highlightRowIndex?, emphasis?, numericAlign?, reveal?, columnMeta?, highlightBest?, density? }
- animation: { kind:"animation", title, pattern, items[{text, icon?, emphasis}] }`;
}

export function buildVisualConfigUserPrompt(
  stepScript: string,
  articleSnippet?: string,
): string {
  const excerpt = articleSnippet?.trim().slice(0, 600);
  return excerpt
    ? `【本步口播】\n${stepScript}\n\n【章節摘錄】\n${excerpt}`
    : `【本步口播】\n${stepScript}`;
}
