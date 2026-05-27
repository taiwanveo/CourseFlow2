import { z } from "zod";

/** 建議的視覺類型（對應教學導演 11 欄中的「建議的視覺類型」） */
export const VisualDirectorTypeSchema = z.enum([
  "scenario",
  "flow",
  "data-flow",
  "architecture",
  "contrast",
  "risk",
  "timeline",
  "metaphor",
  "infographic",
  "interaction",
  "none",
]);

/** 最終輸出通道：AI 靜態圖 / 圖表 / 表格 / 動畫 / 不生成 */
export const VisualDirectorOutputSchema = z.enum([
  "ai-image",
  "chart",
  "table",
  "animation",
  "none",
]);

export const VisualDirectorPlanSchema = z.object({
  screenSummary: z.string().min(1),
  scriptSummary: z.string().min(1),
  coreMessage: z.string().min(1),
  visualType: VisualDirectorTypeSchema,
  recommendedOutput: VisualDirectorOutputSchema,
  sceneDescription: z.string().min(1),
  motionEffect: z.string().min(1),
  imagePromptEn: z.string(),
  animationPromptEn: z.string(),
  animationPromptZh: z.string(),
  avoidElements: z.array(z.string()).min(1).max(10),
  layoutIntegration: z.string().min(1),
  skipReason: z.string().optional(),
});

export type VisualDirectorPlan = z.infer<typeof VisualDirectorPlanSchema>;
export type VisualDirectorType = z.infer<typeof VisualDirectorTypeSchema>;
export type VisualDirectorOutput = z.infer<typeof VisualDirectorOutputSchema>;

export function safeParseVisualDirectorPlan(
  raw: unknown,
): { success: true; data: VisualDirectorPlan } | { success: false; error: string } {
  const r = VisualDirectorPlanSchema.safeParse(raw);
  if (r.success) return { success: true, data: r.data };
  return { success: false, error: r.error.message };
}
