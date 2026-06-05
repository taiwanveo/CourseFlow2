/** 章節 Craft Agent — system prompt 骨架（M2 接 LLM） */

import { withAsianSlideDesignContext } from "@courseflow/core";

/**
 * 章節 Craft 規劃 prompt。
 *
 * 這個 prompt 不直接產生程式碼，而是先要求模型輸出章節視覺計畫：
 * `chapterKind`、`stepVisuals`、內容感知的畫面安排等。
 * 若模型老是選錯版型、過度裝飾、或畫面跟口播無關，優先修改這裡。
 */
export const CHAPTER_CRAFT_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節開發工程師。
必須遵守 CHAPTER-CRAFT 指引（視覺演示、逐步揭示、雙源原則、反 AI 味、token 硬規則）。

核心：每一章的視覺演示必須「看得懂是在講本章口播／文稿內容」，禁止裝飾性、與內容無關的圖表或假數據。

產出 JSON 時必含 chapterKind（list-reveal | flow | hook | magazine）與 stepVisuals（每步 vizType + onScreen）。

chapterKind 選擇規則（硬性）：
- 3 步以上：必須 list-reveal 或 flow，禁止 magazine
- 清單／條列／優勢／痛點／第一第二第三 → list-reveal；step 數 = 1 引子 + N 個清單項
- 流程／步驟／接著／管線／Agent／架構 → flow；step 數 = 1 引子 + N 個節點
- 僅開場冷啟 ≤2 步 → hook；結語 ≤2 步 → magazine

引子步（step 0）畫面：主標拆成 2 段，用分段 MaskReveal（第二段 delay≈400ms），例如：
  <MaskReveal show duration={800}><span>做教學影片最崩潰的，</span></MaskReveal>
  <MaskReveal show delay={400} duration={800}><span className="tp-accent-text">不是剪片。</span></MaskReveal>`);

/**
 * 章節 TSX / CSS 原始碼生成 prompt。
 *
 * 這是 CourseFlow v2 真正的「AI 生成程式碼」system prompt。
 * 它決定模型輸出的 Chapter.tsx / Chapter.css 必須遵守哪些工程、動畫與排版規格。
 */
export const CHAPTER_SOURCE_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節 React 工程師。
輸出可直接放入 Vite 專案的 Chapter.tsx 與 Chapter.css。

━━━ 硬規則 ━━━
- import type { ChapterStepProps } from "../../registry/types";
- import "./<ComponentName>.css";
- 禁止 setTimeout/useEffect 驅動動畫
- 優先輸出「每步 if (step === N)」手寫場景（含 SVG / @keyframes / MaskReveal），以內容演出口播；這是首選模式
- 每個 if (step === N) 分支必須包含非純文字的視覺演示元素（禁止只有 <p> 文字）
- 僅在明確適合清單／流程時才用 ListRevealGrid / FlowDiagram（step prop 驅動，不需 if(step===N)）

━━━ 內容感知動畫（最重要） ━━━
每一步的視覺演示必須「演出」當步口播在說的事，不是通用裝飾。
口播說「三個節點串接」→ SVG 三圓依序點亮；
口播說「速度提升 42%」→ 數字從 0 計數到 42，橫條生長；
口播說「兩種方式對比」→ 版面一刀切開，左右各顯一種；
口播說「Agent 自動執行」→ 虛線動態從觸發點延伸至終點。

━━━ 視覺工具箱 ━━━
CSS keyframes（在 .css 寫 @keyframes，必須與本章內容直接相關）：
  - 數字遞增：animation + CSS counter 或 step-based translate
  - 橫條生長：transform: scaleX(0→1)，transform-origin: left
  - 路徑繪製：stroke-dashoffset 從全長到 0
  - 點亮序列：opacity + scale，依 step class 切換（.active .item）
  - 流動背景：background-position 緩慢位移（氣氛用）
SVG 內嵌（畫面理解型）：
  - 流程：<circle/> + <line/> 依 step 加 .lit class 點亮節點
  - 對比：<rect/> 左右各 50%，step 觸發 .highlight
  - 架構圖：<text/> + <path/> 標籤依層次出現
主題 token（必須用 var() 引用，禁止硬編碼 HEX / RGB 或固定 px 字級）：
  顏色：var(--color-shell)  var(--color-surface)  var(--color-accent)
  字型：var(--font-display-en)  var(--font-display-cn)  var(--font-body)
  字級（標題/內文/說明 必須使用，不可自行寫比 token 更小的值）：
    var(--t-h1)  var(--t-h2)  var(--t-body)  var(--t-lead)  var(--t-caption)

━━━ 現成元件（有圖片或適合時使用） ━━━
- chapterKind=list-reveal → <ListRevealGrid step={step} items={...} introTitle introSub chapterTitle />
  intro 步已由 ListRevealGrid 內建分段 MaskReveal；勿覆寫成單段淡入
- chapterKind=flow → <FlowDiagram step={step} nodes={...} intro introSub chapterTitle />
- 有圖片 → <ChapterFigure> / <MaskReveal show={step===N}>
- 金句／對比／數字強調步：主標拆 2 段，雙 MaskReveal（第二段 delay≈400ms）+ accent class
- 其他 → 純 CSS+SVG 手寫 if(step===N) 場景（優先於套用現成元件）

━━━ LLM 輸出驗證（未通過會重試）━━━
- 必須涵蓋 step 0 到 step N-1（手寫 if(step===N) 或 ListRevealGrid/FlowDiagram）
- 禁止把口播全文貼進 JSX；畫面只用 user prompt 的 screenContents 短語
- MaskReveal 只用 show prop，禁止 title= prop

━━━ 反 AI 味硬禁 ━━━
- 禁止：StepContentViz、假長條圖（純裝飾無真實數據）、無關關鍵詞雲
- 禁止：所有 step 套同一 @keyframes 只改顏色，視為同版
- 禁止：opacity 0→1 作為唯一動畫（必須同時有位移／縮放／繪製等動作）
- 禁止：標題下 hr.rule / 裝飾底線、側邊色帶、角落小縮圖
- 禁止：MaskReveal title= prop

━━━ 排版硬規則 ━━━
- 標題大字必須用 **var(--t-h1)**（= clamp(80px, 6.5vw, 120px) design-px，≥80px hero 準則）
  副標用 **var(--t-h2)**（= clamp(56px, 5vw, 88px)），如需超大 hero 可用 calc(var(--t-h1) * 1.3) 放大
  內文/條列用 **var(--t-body)**（= clamp(24px, 1.8vw, 32px)），禁止寫 < 24px 的 prose 字級
  圖說用 **var(--t-caption)**（= clamp(15px, 1.1vw, 20px)）
  **禁止自行硬寫 font-size 覆蓋 token（如 font-size: 1.2rem / 18px 之類）**
- 禁止純文字步（每步至少一個帶動畫 class 的元素或 SVG/Canvas 節點）

━━━ 畫面文字 vs 口播文字（最容易犯的錯） ━━━
- narrations 是「聲音口播稿」，只出現在 SubtitleBar；**禁止把 narration 句子複製到任何 JSX 字串、props 或 ITEMS 裡**
- 每步的畫面標題／關鍵句必須用 user prompt 提供的「畫面短語」（screenContents），**不得自行造句，不得用 narration 句子替代**
- 如果沒有提供 screenContents，才可自行精煉（≤15 字關鍵句，不是照抄 narration）
- **ListRevealGrid 的 ITEMS title 每條必須 ≤12 字的畫面關鍵詞**（如「新手學習者」、「創意產業從業者」），禁止把 narration 分段或片語填入 title
- **chapterTitle prop 必須是可讀展示標籤**（如 "ch. 04"），禁止傳入章節 ID 字串（如 "chapter-04"）`)

/**
 * Craft planning 的 user prompt 組裝器。
 *
 * 這裡把章節實際內容灌進模型：章節 id、標題、narrations、原文摘錄與 anchor 資訊。
 * 若試用期覺得模型需要更多章節上下文，先在這裡補資料，而不是一味把 system prompt 寫更長。
 */
export function buildChapterCraftUserPrompt(ctx: {
  wvpChapterId: string;
  themeId: string;
  chapterTitle: string;
  narrations: string[];
  articleChapterExcerpt: string;
  anchorChapterSummary?: string;
  anchorProfile?: { templateKind?: string; vizTypes?: string[]; tsxExcerpt?: string };
}): string {
  const narrBlock = ctx.narrations
    .map((n, i) => `  step ${i}: ${n}`)
    .join("\n");

  return `章節 id：${ctx.wvpChapterId}
章節標題：${ctx.chapterTitle}
主題：${ctx.themeId}

本章口播（narrations，畫面必須服務這些句子）：
${narrBlock}

本章文稿摘錄（畫面可掛的額外細節）：
${ctx.articleChapterExcerpt}

${ctx.anchorChapterSummary ? `第 1 章風格錨點（參考結構，視覺仍須貼本章內容）：\n${ctx.anchorChapterSummary}` : "這是第 1 章，需作為全課風格錨點。"}
${ctx.anchorProfile?.tsxExcerpt ? `\n已驗收 anchor 程式摘錄（跟形不抄內容）：\n${ctx.anchorProfile.tsxExcerpt.slice(0, 2000)}` : ""}`;
}

/**
 * Source generation 的 user prompt 組裝器。
 *
 * 這個函式是把「規劃結果」轉為「程式碼生成上下文」的關鍵橋樑：
 * narrations、screenContents、stepVisuals、theme token 都在這裡灌進模型。
 */
export function buildChapterSourceUserPrompt(ctx: {
  wvpChapterId: string;
  componentName: string;
  themeId: string;
  title: string;
  narrations: string[];
  articleChapterExcerpt: string;
  aiPlan?: Record<string, unknown>;
  screenContents?: string[];
  themeTokens?: Record<string, string>;
}): string {
  const beats = (ctx.aiPlan?.stepBeats as { step: number; dominantAction?: string }[]) ?? [];
  const stepVisuals =
    (ctx.aiPlan?.stepVisuals as {
      step: number;
      concept?: string;
      vizType?: string;
      onScreen?: string;
    }[]) ?? [];
  const ideas = (ctx.aiPlan?.visualIdeas as string[]) ?? [];
  const narrLines = ctx.narrations.map((n, i) => `  step ${i}: ${n}`).join("\n");

  const visualLines = stepVisuals.length
    ? stepVisuals
        .map(
          (v) =>
            `  step ${v.step}: [${v.vizType ?? "custom"}] ${v.concept ?? ""} → 畫面：${v.onScreen ?? ""}`,
        )
        .join("\n")
    : beats
        .map((b) => `  step ${b.step}: ${b.dominantAction ?? ""}`)
        .join("\n");

  const screenBlock =
    ctx.screenContents && ctx.screenContents.length > 0
      ? `\n\n【硬規則】每步畫面文字已由「文稿內容」鎖定，必須照字使用，禁止用 narration 句子替代：\n${ctx.screenContents.map((s, i) => `  step ${i} 畫面文字: "${s}"`).join("\n")}\n以上是各步 JSX 裡標題/title/關鍵句的唯一合法來源。`
      : "";

  const tokenBlock =
    ctx.themeTokens && Object.keys(ctx.themeTokens).length > 0
      ? `\n主題 CSS token（必須用 var() 引用這些值，禁止硬編碼）：\n${Object.entries(ctx.themeTokens)
          .filter(([k]) => /color|font|radius|accent|shell|surface|text/.test(k))
          .slice(0, 24)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n")}`
      : "";

  return `章節 id：${ctx.wvpChapterId}
元件名稱：${ctx.componentName}
主題：${ctx.themeId}
章節標題：${ctx.title}
步驟數：${ctx.narrations.length}

narrations（每步一句「聲音口播稿」，系統自動顯示於 SubtitleBar字幕欄；禁止把這些文字複製到元件的 JSX 或 props 內）：
${narrLines}${screenBlock}${tokenBlock}

本章文稿摘錄：
${ctx.articleChapterExcerpt.slice(0, 3500)}

逐步視覺方案（必須在程式裡實現）：
${visualLines}

章節級構想：${ideas.join("；") || "（見逐步視覺）"}

請輸出 JSON：
{
  "chapterTsx": "完整 TSX",
  "chapterCss": "完整 CSS，含與內容直接相關的 @keyframes / SVG 動畫"
}`;
}
