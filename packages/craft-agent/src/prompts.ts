/** 章節 Craft Agent — system prompt 骨架（M2 接 LLM） */

import { withAsianSlideDesignContext } from "@courseflow/core";

export const CHAPTER_CRAFT_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節開發工程師。
必須遵守 CHAPTER-CRAFT 指引（視覺演示、逐步揭示、雙源原則、反 AI 味、token 硬規則）。

核心：每一章的視覺演示必須「看得懂是在講本章口播／文稿內容」，禁止裝飾性、與內容無關的圖表或假數據。

產出 JSON 時必含 chapterKind（list-reveal | flow | hook | magazine）與 stepVisuals（每步 vizType + onScreen）。
清單型口播：chapterKind=list-reveal，且 step 數 = 1 引子 + N 個清單項。流程型：chapterKind=flow。`);

export const CHAPTER_SOURCE_SYSTEM_PROMPT = withAsianSlideDesignContext(`你是 Web Video Presentation 章節 React 工程師。
輸出可直接放入 Vite 專案的 Chapter.tsx 與 Chapter.css。

硬規則：
- import type { ChapterStepProps } from "../../registry/types";
- import "./<ComponentName>.css";
- 禁止 setTimeout/useEffect 驅動動畫

視覺演示（與內容強綁定，優先使用現成元件）：
- chapterKind=list-reveal → 使用 <ListRevealGrid step={step} items={...} introTitle introSub chapterTitle />，ITEMS 從 narrations[1..] 填 title/body
- chapterKind=flow → 使用 <FlowDiagram step={step} nodes={...} intro chapterTitle />，NODES 從 narrations[1..] 填 label/detail
- 其他 → MaskReveal show + NarrationBeat，畫面文字必須來自口播原文
- 禁止：StepContentViz、假長條圖、無關關鍵詞雲、MaskReveal title= prop
- 禁止：標題下 hr.rule / 裝飾底線、側邊色帶、每步同版、純文字步、角落小縮圖
- 標題大字（clamp 2.75rem+）、內文左對齊 18–22px、插圖 ≥ 版面 30%
- TSX 內須含各步口播前 12 字；可從 article 摘錄掛 mono cue（雙源）`);

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

  return `章節 id：${ctx.wvpChapterId}
元件名稱：${ctx.componentName}
主題：${ctx.themeId}
章節標題：${ctx.title}
步驟數：${ctx.narrations.length}

narrations（NarrationBeat 的 phrases 必須是對應步口播的原文拆句，不可改寫）：
${narrLines}

本章文稿摘錄：
${ctx.articleChapterExcerpt.slice(0, 3500)}

逐步視覺方案（必須在程式裡實現）：
${visualLines}

章節級構想：${ideas.join("；") || "（見逐步視覺）"}

請輸出 JSON：
{
  "chapterTsx": "完整 TSX",
  "chapterCss": "完整 CSS，含與內容相關的 @keyframes"
}`;
}
