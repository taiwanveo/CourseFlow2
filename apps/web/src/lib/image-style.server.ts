import "server-only";

import type { WvpImageStyleSelection } from "@/lib/wvp-settings";
import {
  getImageStyleById,
  getImageStylePromptZh,
  isValidBananaxStyleId,
} from "@/lib/bananax-catalog";
import {
  loadDesignTokensForTheme,
  type DesignTokens,
} from "@courseflow/visual-config";

/**
 * 把 WVP 主題 tokens 轉成生圖 styleFragment。
 * 當使用者未選 BananaX 風格時作為預設，確保生成的插圖配色與投影片主題一致。
 */
export function buildThemeStyleFragment(tokens: DesignTokens): string {
  const mode = tokens.darkMode ? "深色背景（暗底亮圖）" : "淺色背景（亮底深圖）";
  const radius = tokens.radius >= 12 ? "偏圓潤" : "偏方正";
  return [
    "【主題配色系統 — 請確保插圖配色與下列 token 高度一致，能無縫融合投影片視覺】",
    `- 主色調：${tokens.colors.primary}（主要視覺元素、標題重點）`,
    `- 輔色：${tokens.colors.secondary}（次要元素、對比點）`,
    `- 強調色：${tokens.colors.accent}（高亮、焦點元素）`,
    `- 背景色：${tokens.colors.surface}（插圖主要背景基調）`,
    `- 文字色：${tokens.colors.text}（若有文字時使用）`,
    `- 靜音色：${tokens.colors.muted}（輔助元素、陰影）`,
    `- 字型風格：${tokens.font.label}（影響整體排版氣質）`,
    `- 視覺模式：${mode}`,
    `- 風格關鍵字：${tokens.moods.join("、")}`,
    `- 圓角感：${radius}`,
    "請保持插圖與投影片同一視覺語言：相同配色系統、相似氛圍與材質感，避免與主題色調產生衝突。",
  ].join("\n");
}

/**
 * 解析生圖風格片段：
 * - 若選了 BananaX 風格 → 回傳對應的中文風格規範
 * - 若未選（null / undefined）且有 themeId → 根據 WVP 主題 tokens 生成配色風格描述
 * - 兩者皆無 → undefined（由 buildStepImagePrompt 走通用英文 fallback）
 */
export async function resolveImageStyleFragment(
  selection: WvpImageStyleSelection | null | undefined,
  themeId?: string | null,
): Promise<string | undefined> {
  const bananaxFragment = getImageStylePromptZh(selection?.id);
  if (bananaxFragment) return bananaxFragment;

  if (themeId?.trim()) {
    const tokens = await loadDesignTokensForTheme(themeId.trim());
    return buildThemeStyleFragment(tokens);
  }

  return undefined;
}

export function isValidImageStyleId(id: string): boolean {
  return isValidBananaxStyleId(id);
}

export { getImageStyleById };

