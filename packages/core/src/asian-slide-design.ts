/**
 * 亞洲簡報設計準則 — CourseFlow 共用 prompt 片段。
 * 完整技能說明見 repo 根目錄 skills/asian-slide-design/SKILL.md
 */
export const ASIAN_SLIDE_DESIGN_SKILL_NAME = "asian-slide-design";

/** 打包／生成前必遵守的硬規則（機械式 if-then） */
export const ASIAN_SLIDE_PACK_HARD_RULES = `
【CourseFlow 打包硬規則 — asian-slide-design】
- 每步至少一個視覺元素（大數字、插圖、圖表、清單格、流程節點等）；禁止純文字步。
- 內文與條列一律左對齊；僅標題可置中。
- 標題下方禁止裝飾性底線（hr.rule、border-bottom 裝飾線、標題下 accent 線）。
- 禁止整條彩色橫幅、頁首頁尾色帶、側邊色條（除非使用者明確要求）。
- 不要每步同一版面；在雙欄、大數字 callout、滿版圖、清單格、流程圖之間輪替。
- 不要預設藍色或米色背景；沿用主題 tokens，不硬編碼 #fff8e7 / corporate blue。
- 文字不可溢出或被截斷；放不下就縮句、拆步或縮字級，不可 clip。
- 插圖／圖表佔版面 ≥30%，禁止角落小縮圖裝飾。
`.trim();

/** LLM 排版／視覺決策用精簡準則 */
export const ASIAN_SLIDE_DESIGN_LAYOUT_RULES = `
【亞洲簡報設計 — 排版判斷（排版前必讀）】
哲學：簡報是溝通工具；清楚＝美。視覺化≠硬塞庫存圖；減法優先。
內容：一頁一訊息；關鍵訊息 ≤13 字；倒三角（先結論再細節）。
版面：
- 關鍵訊息放中央線略偏上；標題用 **var(--t-h1)**（≥80px design-px，遠觀清晰準則）、副標 **var(--t-h2)**（≥56px）、內文 **var(--t-body)**（≥24px，禁止更小）、圖說 **var(--t-caption)**；字級對比要拉開。
- 邊距 ≥0.5 吋（stage padding）；區塊間距一致。
- 圖表：一步一圖、圖左文右；複雜圖表放附錄。
- 照片：滿版或 ≥30% 面積；滿版時用半透明白底襯文字。
配圖三問：① 圖意義與訊息一致？② 拿掉會變弱？③ 會搶標題？— 否則不放。
禁止 AI 風：標題下底線、色帶、每頁同版、內文置中、小字小圖、假裝飾圖。
`.trim();

export function withAsianSlideDesignContext(systemPrompt: string): string {
  return [
    systemPrompt.trim(),
    "",
    ASIAN_SLIDE_PACK_HARD_RULES,
    ASIAN_SLIDE_DESIGN_LAYOUT_RULES,
  ].join("\n");
}
