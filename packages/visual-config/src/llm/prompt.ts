import type { VisualDirectorPlan } from "../schema/visual-director.js";
import type { DesignTokens } from "../tokens/theme-bridge.js";
import { withAsianSlideDesignContext } from "@courseflow/core";

export function buildVisualConfigSystemPrompt(theme: DesignTokens): string {
  return withAsianSlideDesignContext(`你是「簡報視覺導演、動態插圖設計師、教學設計顧問」。
你的任務不是重複文字，而是把抽象概念轉為可教學、可理解的視覺輔助。

【當前簡報主題】
- 字型風格：${theme.font.label}
- 風格關鍵字：${theme.moods.join("、") || "通用"}
- 模式：${theme.darkMode ? "深色" : "淺色"}

【教學導向決策原則】
1. 先判斷「這一步真正要教會觀眾什麼」：流程？因果？對比？風險？趨勢？
2. 優先用最能補足理解缺口的視覺，不做裝飾性選型。
3. 不要把螢幕文字或口播稿原句直接搬進圖裡；圖只放必要關鍵詞。
4. 若內容是比較/評估/取捨，優先 table 或 bar；若是趨勢/時序，優先 line/area；
   若是比例結構，優先 pie；若是單一關鍵指標，優先 kpi。
5. 若內容是流程、步驟、角色互動、資料路徑，優先 animation（process-flow / reveal-list / callout）。
6. 若沒有可視化價值，回傳最精簡的 animation/callout，不要硬造複雜圖表。
7. 每一步風格須與既有主題一致（顏色氣質、密度、語氣）。
8. 避免過度科技感、過度抽象、過度雜亂。
9. 輸出需可直接給前端渲染，不要加入 schema 以外欄位。

【結構規則】
- 數值必須是純 number，單位放 unit / columnMeta.unit。
- colorRole：強調單一對象用 highlight，分類用 categorical，連續量用 sequential。
- table 目標：像「資料對照卡」一樣可讀且可比較
   - columns 至少 2 欄；第一欄通常是名稱/項目（key 可用 item）
   - rows 每列至少要有 columns 所有 key；數值欄用純 number（單位放 columnMeta.unit）
   - sortBy（key + asc/desc）、highlightColumn / highlightRowIndex / emphasis
   - columnMeta[]：{ key, format:"text"|"number"|"percent"|"currency", unit?, miniBar? }
     - 比例/占比 → percent；金額 → currency；可比較數值欄可 miniBar:true
   - highlightBest：{ key, direction:"max"|"min" } 標出該欄最佳列（成本/延遲用 min，分數/品質用 max）
   - numericAlign: "right"；reveal: "row"|"column"；density: "compact"|"comfortable"

只回傳一個合法 JSON 物件，不要 Markdown、不要註解：
- chart: { kind:"chart", chartType, title, subtitle?, xKey, yKey, data[], unit?, colorRole, designNote? }
  - subtitle 可省略；若有，限 20 字內短語，禁止口播句、禁止「假設資料顯示」類敘述
  - data 的 xKey 欄位只用週次／方案名等短標籤，禁止「口播」或口播稿摘錄
- table: { kind:"table", title, columns[], rows[], highlightColumn?, sortBy?, highlightRowIndex?, emphasis?, numericAlign?, reveal?, columnMeta?, highlightBest?, density? }
- animation: { kind:"animation", title, pattern, items[{text, icon?, emphasis}] }`);
}

export function buildVisualConfigUserPrompt(
  stepScript: string,
  articleSnippet?: string,
  screenContent?: string,
  directorPlan?: VisualDirectorPlan,
): string {
  const screen = screenContent?.trim().slice(0, 600);
  const excerpt = articleSnippet?.trim().slice(0, 600);
  const directorBlock = directorPlan
    ? [
        "\n【Visual Director 計畫 — 請依此渲染，勿偏離】",
        `- 核心訊息：${directorPlan.coreMessage}`,
        `- 建議視覺類型：${directorPlan.visualType}`,
        `- 建議輸出：${directorPlan.recommendedOutput}`,
        `- 畫面描述：${directorPlan.sceneDescription}`,
        `- 動態效果：${directorPlan.motionEffect}`,
        `- 整合建議：${directorPlan.layoutIntegration}`,
        `- 避免：${directorPlan.avoidElements.join("、")}`,
        directorPlan.animationPromptZh
          ? `- 動畫說明：${directorPlan.animationPromptZh}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  return [
    "請根據下列資訊，先在心中完成這 4 件事，再輸出 JSON：",
    "1) 萃取核心教學訊息",
    "2) 找出觀眾最可能不懂的點",
    "3) 選擇最能補足理解的視覺類型（chart/table/animation）",
    "4) 設計最小必要資訊量（避免文字重複與畫面噪音）",
    screen ? `\n【本步螢幕文字】\n${screen}` : "",
    `\n【本步口播】\n${stepScript}`,
    excerpt ? `\n【章節摘錄】\n${excerpt}` : "",
    directorBlock,
    "\n提醒：若 Visual Director 建議 chart/table/animation，請輸出對應 kind；若建議 none 或 ai-image，仍輸出最精簡 animation/callout 作為保底（由上游決定是否採用）。",
  ]
    .filter(Boolean)
    .join("\n");
}
