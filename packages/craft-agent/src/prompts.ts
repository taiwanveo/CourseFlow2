/** 章節 Craft Agent — system prompt 骨架（M2 接 LLM） */

import { withAsianSlideDesignContext } from "@courseflow/core";

export const CHAPTER_CRAFT_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節開發工程師。
必須遵守 CHAPTER-CRAFT 指引（視覺演示、逐步揭示、雙源原則、反 AI 味、token 硬規則）。

核心：每一章的視覺演示必須「看得懂是在講本章口播／文稿內容」，禁止裝飾性、與內容無關的圖表或假數據。

產出 JSON 時必含 chapterKind（list-reveal | flow | hook | magazine）與 stepVisuals（每步 vizType + onScreen）。
清單型口播：chapterKind=list-reveal，且 step 數 = 1 引子 + N 個清單項。流程型：chapterKind=flow。`);

export const CHAPTER_SOURCE_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節 React 工程師。
輸出可直接放入 Vite 專案的 Chapter.tsx 與 Chapter.css。

━━━ 硬規則 ━━━
- import type { ChapterStepProps } from "../../registry/types";
- import "./<ComponentName>.css";
- 禁止 setTimeout/useEffect 驅動動畫
- 每個 if (step === N) 分支必須包含非純文字的視覺演示元素

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
主題 token（必須用 var() 引用，禁止硬編碼 HEX / RGB）：
  var(--color-shell)  var(--color-surface)  var(--color-accent)
  var(--font-display-en)  var(--font-display-cn)  var(--font-body)

━━━ 現成元件（有圖片或適合時使用） ━━━
- chapterKind=list-reveal → <ListRevealGrid step={step} items={...} introTitle introSub chapterTitle />
- chapterKind=flow → <FlowDiagram step={step} nodes={...} intro chapterTitle />
- 有圖片 → <ChapterFigure> / <MaskReveal show={step===N}>
- 其他 → 純 CSS+SVG 手寫，不強制使用上述元件

━━━ 反 AI 味硬禁 ━━━
- 禁止：StepContentViz、假長條圖（純裝飾無真實數據）、無關關鍵詞雲
- 禁止：所有 step 套同一 @keyframes 只改顏色，視為同版
- 禁止：opacity 0→1 作為唯一動畫（必須同時有位移／縮放／繪製等動作）
- 禁止：標題下 hr.rule / 裝飾底線、側邊色帶、角落小縮圖
- 禁止：MaskReveal title= prop

━━━ 排版硬規則 ━━━
- 標題大字 clamp(2.75rem, 4.5vw, 5rem)，內文左對齊 18–22px
- TSX 內須含各步口播前 12 字（雙源：畫面 + 口播同步）
- 禁止純文字步（每步至少一個帶動畫 class 的元素或 SVG/Canvas 節點）`);

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
      ? `\n每步畫面短語（animation 必須呼應這些文字）：\n${ctx.screenContents.map((s, i) => `  step ${i}: ${s}`).join("\n")}`
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

narrations（NarrationBeat 的 phrases 必須是對應步口播的原文拆句，不可改寫）：
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
