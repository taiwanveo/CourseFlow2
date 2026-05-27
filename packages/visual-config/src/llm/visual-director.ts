import type { LlmJsonCaller } from "./generate.js";
import {
  safeParseVisualDirectorPlan,
  type VisualDirectorPlan,
} from "../schema/visual-director.js";
import { inferVisualConfigFromText } from "../heuristic.js";
import type { DesignTokens } from "../tokens/theme-bridge.js";
import {
  buildVisualDirectorSystemPrompt,
  buildVisualDirectorUserPrompt,
} from "./visual-director-prompt.js";

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
}

function inferDirectorPlanHeuristic(opts: {
  screenContent: string;
  stepScript: string;
}): VisualDirectorPlan {
  const screen = opts.screenContent.trim();
  const script = opts.stepScript.trim();
  const blob = `${screen}\n${script}`.trim();
  const screenSummary = screen.slice(0, 80) || "（螢幕文字較少）";
  const scriptSummary = script.slice(0, 120) || "（口播較少）";
  const coreMessage = scriptSummary.slice(0, 100) || screenSummary;

  const heuristic = inferVisualConfigFromText(blob);
  let recommendedOutput: VisualDirectorPlan["recommendedOutput"] = "ai-image";
  let visualType: VisualDirectorPlan["visualType"] = "metaphor";
  let motionEffect = "關鍵元素逐一淡入，主視覺最後定格";
  let skipReason: string | undefined;

  if (!blob || blob.length < 8) {
    recommendedOutput = "none";
    visualType = "none";
    skipReason = "本步內容過少，文字已足夠傳達";
  } else if (heuristic?.kind === "chart") {
    recommendedOutput = "chart";
    visualType = "infographic";
    motionEffect = "數值或長條依序揭示，強調可比較關係";
  } else if (heuristic?.kind === "table") {
    recommendedOutput = "table";
    visualType = "contrast";
    motionEffect = "列或欄逐步揭示，突出最佳方案";
  } else if (heuristic?.kind === "animation") {
    recommendedOutput = "animation";
    visualType = heuristic.pattern === "process-flow" ? "flow" : "infographic";
    motionEffect =
      heuristic.pattern === "process-flow"
        ? "流程節點逐步亮起，連線依序出現"
        : "重點條目逐一揭示";
  } else if (/(?:風險|警告|陷阱|危險)/.test(blob)) {
    visualType = "risk";
    motionEffect = "警示元素短暫閃爍後穩定，引導視線到核心風險";
  } else if (/(?:流程|步驟|管線|链路|鏈路|Agent)/i.test(blob)) {
    visualType = "flow";
    recommendedOutput = "animation";
    motionEffect = "節點連線逐步亮起，資料沿路徑流動";
  }

  const sceneDescription =
    recommendedOutput === "ai-image"
      ? `以概念隱喻或情境呈現「${coreMessage.slice(0, 40)}」，單一主體、留白充足、無可讀文字`
      : `以${recommendedOutput} 呈現核心訊息，避免重複螢幕文字`;

  return {
    screenSummary,
    scriptSummary,
    coreMessage,
    visualType,
    recommendedOutput,
    sceneDescription,
    motionEffect,
    imagePromptEn:
      recommendedOutput === "ai-image"
        ? `Educational 16:9 illustration for: ${coreMessage}. Single clear metaphor, no text, no logos, soft lighting, uncluttered composition.`
        : "",
    animationPromptEn:
      recommendedOutput === "none"
        ? ""
        : `Presentation motion for teaching slide: ${motionEffect}. Concept: ${coreMessage}. Clean, minimal, no flashy effects.`,
    animationPromptZh: motionEffect,
    avoidElements: [
      "可讀文字與數字",
      "商標與 logo",
      "過度科技感裝飾",
      "與主題無關的素材圖",
    ],
    layoutIntegration:
      recommendedOutput === "ai-image"
        ? "建議作為右側插圖或下半部輔助圖，標題保留在左側"
        : "建議作為主視覺區塊，文字精簡保留在上方",
    skipReason,
  };
}

export type AnalyzeStepVisualPlanResult = {
  plan: VisualDirectorPlan;
  source: "llm" | "heuristic";
  attempts: number;
};

/** Visual Director：逐頁分析並產出 11 欄對應的結構化視覺計畫 */
export async function analyzeStepVisualPlan(opts: {
  stepIndex: number;
  courseTopic: string;
  screenContent: string;
  stepScript: string;
  articleSnippet?: string;
  theme: DesignTokens;
  llm?: LlmJsonCaller;
  maxRetries?: number;
}): Promise<AnalyzeStepVisualPlanResult> {
  const maxRetries = opts.maxRetries ?? 2;

  if (opts.llm) {
    const system = buildVisualDirectorSystemPrompt(opts.theme);
    const user = buildVisualDirectorUserPrompt({
      stepIndex: opts.stepIndex,
      courseTopic: opts.courseTopic,
      screenContent: opts.screenContent,
      stepScript: opts.stepScript,
      articleSnippet: opts.articleSnippet,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const raw = await opts.llm(
          system,
          attempt === 1
            ? user
            : `${user}\n\n【修正】上次 JSON 不符合 schema。請只輸出合法 JSON，recommendedOutput 必須是 ai-image|chart|table|animation|none 之一。`,
        );
        const parsed = extractJsonObject(raw);
        const validated = safeParseVisualDirectorPlan(parsed);
        if (validated.success) {
          return { plan: validated.data, source: "llm", attempts: attempt };
        }
      } catch {
        /* retry */
      }
    }
  }

  return {
    plan: inferDirectorPlanHeuristic({
      screenContent: opts.screenContent,
      stepScript: opts.stepScript,
    }),
    source: "heuristic",
    attempts: 0,
  };
}
