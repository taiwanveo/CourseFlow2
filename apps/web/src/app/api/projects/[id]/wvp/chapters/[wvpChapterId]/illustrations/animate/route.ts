import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { assertWvpPhaseEditable } from "@courseflow/core";
import { loadProjectComposition } from "@/lib/project-composition";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import {
  getChapterIllustrationsState,
  patchChapterIllustrationPrompts,
} from "@/lib/wvp-craft-illustrations";
import { decryptApiKey } from "@/lib/crypto";
import { resolveEffectiveTextModel } from "@/lib/llm-provider";
import { listConfiguredLlmProviders } from "@/lib/llm-provider";
import { narrationsForChapter, orderedWvpStepsForChapter } from "@/lib/wvp-chapters";
import {
  chapterKindForCraft,
  resolveCompositionChapterForCraft,
  screenContentsForChapter,
} from "@/lib/wvp-chapter-meta";
import { writePresentationAnimationFile } from "@/lib/wvp-animation-sync";
import {
  animationHtmlIssueMessage,
  extractAnimationHtml,
  inspectAnimationHtml,
} from "@/lib/wvp-animation-html";
import { presentationDirForProject } from "@/lib/wvp-workdir";
import { inferExplainAnimation, renderExplainAnimationHtml } from "@courseflow/explain-animation";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Theme token profiles ───────────────────────────────────────────────────
// Each profile mirrors the key CSS variables from the corresponding tokens.css.
// These are injected as a <style>:root{} block into the generated HTML so the
// LLM only needs to reference var(--X) rather than hardcoding colors.

interface ThemeProfile {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  textMute: string;
  accent: string;
  accentSoft: string;
  fontDisplay: string;
  fontBody: string;
  durBase: string;
  durSlow: string;
  rCard: string;
  ruleStyle: string;
  /** Short design-personality note injected into the LLM prompt */
  personality: string;
}

const THEME_DATA: Record<string, ThemeProfile> = {
  "midnight-press": {
    bg: "#0d0b09", surface: "#1a1714", surface2: "#231f1a",
    text: "#f5f0e5", text2: "#ece4d2", textMute: "#7a7972",
    accent: "#ff4a2b", accentSoft: "rgba(255,74,43,0.14)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Manrope","Inter","Noto Sans SC",sans-serif`,
    durBase: "700ms", durSlow: "1100ms", rCard: "4px", ruleStyle: "solid",
    personality: "電影暗色、暖褐底色、serif 排版、橙紅強調、cinematic 慢節奏",
  },
  "warm-keynote": {
    bg: "#f5efe1", surface: "#fdfbf7", surface2: "#ffffff",
    text: "#43302b", text2: "#5b443d", textMute: "#8a7969",
    accent: "#14b8a6", accentSoft: "rgba(20,184,166,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Inter","Noto Sans SC",sans-serif`,
    durBase: "500ms", durSlow: "800ms", rCard: "32px", ruleStyle: "solid",
    personality: "SaaS keynote 溫暖乳白底色、teal 強調色、大圓角卡片、彈跳活力感",
  },
  "newsroom": {
    bg: "#c8bca0", surface: "#f1ebd8", surface2: "#f8f3e2",
    text: "#14110b", text2: "#2a261a", textMute: "#5e564a",
    accent: "#c8260d", accentSoft: "rgba(200,38,13,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Source Serif 4","Noto Serif SC",serif`,
    durBase: "650ms", durSlow: "1000ms", rCard: "0px", ruleStyle: "solid",
    personality: "報紙乳白底色、墨黑文字、banner 紅強調色、廣版報章排版（淺色主題）",
  },
  "bauhaus-bold": {
    bg: "#f4f1ea", surface: "#f4f1ea", surface2: "#ffffff",
    text: "#0a0a0a", text2: "#1f1f1f", textMute: "#5a5a5a",
    accent: "#2541ee", accentSoft: "rgba(37,65,238,0.12)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Inter","Noto Sans SC",sans-serif`,
    durBase: "400ms", durSlow: "650ms", rCard: "0px", ruleStyle: "solid",
    personality: "包浩斯幾何主義、白底黑字、primary-blue 強調色、直角零圓弧、快節奏（淺色主題）",
  },
  "blueprint": {
    bg: "#0a1224", surface: "#0e1a2e", surface2: "#142441",
    text: "#d6e5ff", text2: "#a8c2f0", textMute: "#6c89b8",
    accent: "#4dd2ff", accentSoft: "rgba(77,210,255,0.10)",
    fontDisplay: `"IBM Plex Sans","Noto Sans SC",sans-serif`,
    fontBody: `"IBM Plex Sans","Noto Sans SC",sans-serif`,
    durBase: "500ms", durSlow: "800ms", rCard: "0px", ruleStyle: "dashed",
    personality: "工程藍圖、深海藍底色、cyan 高亮、2px dashed 邊框、精密技術感",
  },
  "chalk-garden": {
    bg: "#16171c", surface: "#1e1e24", surface2: "#28282f",
    text: "#f4f4f5", text2: "#d4d4d8", textMute: "#a1a1aa",
    accent: "#facc15", accentSoft: "rgba(250,204,21,0.14)",
    fontDisplay: `"Noto Serif SC",serif`,
    fontBody: `"Noto Sans SC",sans-serif`,
    durBase: "650ms", durSlow: "950ms", rCard: "8px", ruleStyle: "dashed",
    personality: "黑板粉筆風格、深石板底色、粉筆黃強調色、dashed 邊框手繪質感",
  },
  "paper-press": {
    bg: "#d8cfb8", surface: "#efe7d6", surface2: "#f5f0e5",
    text: "#1a1714", text2: "#2c2823", textMute: "#6b685e",
    accent: "#ff4a2b", accentSoft: "rgba(255,74,43,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Manrope","Noto Sans SC",sans-serif`,
    durBase: "700ms", durSlow: "1100ms", rCard: "4px", ruleStyle: "solid",
    personality: "舊報紙質感、米褐底色、暖色調、橙紅強調色（淺色主題）",
  },
  "terminal-green": {
    bg: "#000000", surface: "#050a07", surface2: "#0a1410",
    text: "#41ff97", text2: "#2ed084", textMute: "#1a8a55",
    accent: "#41ff97", accentSoft: "rgba(65,255,151,0.10)",
    fontDisplay: `"JetBrains Mono","Noto Sans Mono CJK SC",monospace`,
    fontBody: `"JetBrains Mono",monospace`,
    durBase: "400ms", durSlow: "650ms", rCard: "0px", ruleStyle: "solid",
    personality: "終端機像素風、純黑底色、matrix 綠色文字、等寬字型、snappy 快節奏",
  },
  "sunset-zine": {
    bg: "#f4d4b6", surface: "#fcecd4", surface2: "#ffe6c8",
    text: "#2a1810", text2: "#4a2c20", textMute: "#7a5040",
    accent: "#e91e63", accentSoft: "rgba(233,30,99,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Noto Serif SC",serif`,
    durBase: "550ms", durSlow: "850ms", rCard: "8px", ruleStyle: "dashed",
    personality: "夕陽色 zine 美學、橙米底色、riso 洋紅強調色、手切手貼質感（淺色主題）",
  },
  "monochrome-print": {
    bg: "#e8e3d8", surface: "#fbf9f4", surface2: "#ffffff",
    text: "#0e1418", text2: "#1f2a32", textMute: "#6b7178",
    accent: "#1a3a8c", accentSoft: "rgba(26,58,140,0.08)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Source Serif 4","Noto Serif SC",serif`,
    durBase: "750ms", durSlow: "1200ms", rCard: "4px", ruleStyle: "solid",
    personality: "精緻黑白印刷、米白底色、深藍強調色、細膩慢節奏（淺色主題）",
  },
  // ─── 13 CourseFlow-fork themes ────────────────────────────────────────────
  "bold-signal": {
    bg: "#0c0c0c", surface: "#1a1a1a", surface2: "#2d2d2d",
    text: "#f5f5f5", text2: "#d8d8d8", textMute: "#8a8a8a",
    accent: "#ff5722", accentSoft: "rgba(255,87,34,0.14)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Space Grotesk","Inter","Noto Sans SC",sans-serif`,
    durBase: "420ms", durSlow: "680ms", rCard: "12px", ruleStyle: "solid",
    personality: "英雄 pitch-deck 暗色底、熱橙強調色、Archivo Black 粗體、快節奏衝勁感",
  },
  "creative-voltage": {
    bg: "#001a4d", surface: "#0033b8", surface2: "#00257d",
    text: "#ffffff", text2: "#e8eaff", textMute: "#98a4d8",
    accent: "#d4ff00", accentSoft: "rgba(212,255,0,0.14)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Space Mono","JetBrains Mono","Noto Sans SC",monospace`,
    durBase: "450ms", durSlow: "720ms", rCard: "4px", ruleStyle: "solid",
    personality: "電藍底色、霓虹黃強調色、等寬字體龐克設計美感、快節奏衝勁感",
  },
  "dark-botanical": {
    bg: "#0a0a0a", surface: "#141312", surface2: "#1c1a18",
    text: "#e8e4df", text2: "#c8c0b6", textMute: "#7a7268",
    accent: "#d4a574", accentSoft: "rgba(212,165,116,0.12)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"IBM Plex Sans","Manrope","Noto Sans SC",sans-serif`,
    durBase: "750ms", durSlow: "1200ms", rCard: "4px", ruleStyle: "solid",
    personality: "暗色植物學、純黑底色、暖赭金強調色、Cormorant 斜體 serif、慢節奏高雅感",
  },
  "dune": {
    bg: "#dcc8a5", surface: "#f0e6d2", surface2: "#f6ecd9",
    text: "#1f1a14", text2: "#2d2620", textMute: "#6b5c46",
    accent: "#8c6a48", accentSoft: "rgba(140,106,72,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Source Serif 4","Noto Serif SC",serif`,
    durBase: "780ms", durSlow: "1250ms", rCard: "4px", ruleStyle: "solid",
    personality: "沙丘美學、米褐底色、啞光赭色調、serif 正文字體、最慢畫廊節奏",
  },
  "electric-studio": {
    bg: "#0a0a0a", surface: "#ffffff", surface2: "#f5f7fb",
    text: "#0a0a0a", text2: "#1f2530", textMute: "#5a6478",
    accent: "#4361ee", accentSoft: "rgba(67,97,238,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Manrope","Inter","Noto Sans SC",sans-serif`,
    durBase: "420ms", durSlow: "700ms", rCard: "12px", ruleStyle: "solid",
    personality: "電藍企業白底風格、Manrope 字體、現代企業感快節奏",
  },
  "forest-ink": {
    bg: "#ece7da", surface: "#f5f1e8", surface2: "#faf7ee",
    text: "#1a2e1f", text2: "#253d2c", textMute: "#5c6a5e",
    accent: "#4d7a4d", accentSoft: "rgba(77,122,77,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Source Serif 4","Noto Serif SC",serif`,
    durBase: "720ms", durSlow: "1150ms", rCard: "4px", ruleStyle: "solid",
    personality: "森林墨水、暖米底色、森林綠文字兼強調色、Playfair Display 斜體、慢紀錄片節奏",
  },
  "indigo-porcelain": {
    bg: "#e4e8ec", surface: "#f1f3f5", surface2: "#f8fafc",
    text: "#0a1f3d", text2: "#152a4a", textMute: "#4a5a78",
    accent: "#1e3a8a", accentSoft: "rgba(30,58,138,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"IBM Plex Sans","Manrope","Noto Sans SC",sans-serif`,
    durBase: "680ms", durSlow: "1050ms", rCard: "4px", ruleStyle: "solid",
    personality: "靛藍瓷器、淡灰底色、深靛藍文字兼強調色、Playfair Display 斜體、學術安靜節奏",
  },
  "kraft-paper": {
    bg: "#dccab0", surface: "#eedfc7", surface2: "#f3e9d6",
    text: "#2a1e13", text2: "#3a2a1d", textMute: "#6e5a40",
    accent: "#a35b2a", accentSoft: "rgba(163,91,42,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Source Serif 4","Noto Serif SC",serif`,
    durBase: "720ms", durSlow: "1100ms", rCard: "4px", ruleStyle: "solid",
    personality: "牛皮紙質感、暖褐米底色、銅鏽強調色、Fraunces 斜體、翻頁觸覺節奏",
  },
  "neon-cyber": {
    bg: "#04060f", surface: "#0a0f1c", surface2: "#111828",
    text: "#e8f4ff", text2: "#b8c8e0", textMute: "#6a7a98",
    accent: "#00ffcc", accentSoft: "rgba(0,255,204,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Satoshi","Inter","Noto Sans SC",sans-serif`,
    durBase: "380ms", durSlow: "650ms", rCard: "4px", ruleStyle: "solid",
    personality: "霓虹賽博龐克、近純黑底色、電青強調色、品紅 glow、snappy 超快節奏",
  },
  "pastel-dream": {
    bg: "#c8d9e6", surface: "#faf9f7", surface2: "#ffffff",
    text: "#1f2429", text2: "#3a4046", textMute: "#707880",
    accent: "#5a7c6a", accentSoft: "rgba(90,124,106,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Plus Jakarta Sans","Inter","Noto Sans SC",sans-serif`,
    durBase: "520ms", durSlow: "820ms", rCard: "20px", ruleStyle: "solid",
    personality: "柔和夢幻、天藍 shell、暖白底色、鼠尾草綠強調色、大圓角卡片、輕柔彈跳節奏",
  },
  "split-canvas": {
    bg: "#dcc7b8", surface: "#f5e6dc", surface2: "#e4dff0",
    text: "#1a1410", text2: "#322820", textMute: "#6b5a4d",
    accent: "#d24a78", accentSoft: "rgba(210,74,120,0.10)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Outfit","Inter","Noto Sans SC",sans-serif`,
    durBase: "480ms", durSlow: "780ms", rCard: "12px", ruleStyle: "solid",
    personality: "雙色分割畫布、桃色與薰衣草底色、品紅強調色、Outfit 字體、活潑中快節奏",
  },
  "swiss-ikb": {
    bg: "#e8e8e6", surface: "#fafaf8", surface2: "#f0f0ee",
    text: "#0a0a0a", text2: "#2a2a2a", textMute: "#737373",
    accent: "#002fa7", accentSoft: "rgba(0,47,167,0.08)",
    fontDisplay: `"Noto Sans SC","Source Han Sans SC",sans-serif`,
    fontBody: `"Inter","Helvetica Neue","Noto Sans SC",sans-serif`,
    durBase: "400ms", durSlow: "650ms", rCard: "0px", ruleStyle: "solid",
    personality: "瑞士國際主義、淡灰白底色、IKB 克萊因藍強調色、無裝飾直角、punchy linear 節奏",
  },
  "vintage-editorial": {
    bg: "#e8e0cf", surface: "#f5f3ee", surface2: "#fbf9f3",
    text: "#1a1a1a", text2: "#2e2a25", textMute: "#6b6357",
    accent: "#c25e3a", accentSoft: "rgba(194,94,58,0.10)",
    fontDisplay: `"Noto Serif SC","Source Han Serif SC",serif`,
    fontBody: `"Work Sans","Inter","Noto Sans SC",sans-serif`,
    durBase: "600ms", durSlow: "950ms", rCard: "4px", ruleStyle: "solid",
    personality: "復古出版社、米褐底色、暖赭紅強調色、Fraunces 斜體、輕微彈跳中節奏",
  },
};

/** Returns a CSS :root{} block + base resets with all theme tokens for injection */
function buildThemeCss(themeId: string): string {
  const t = THEME_DATA[themeId] ?? THEME_DATA["midnight-press"]!;
  return `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${t.bg};
  --surface:${t.surface};
  --surface-2:${t.surface2};
  --text:${t.text};
  --text-2:${t.text2};
  --text-mute:${t.textMute};
  --accent:${t.accent};
  --accent-soft:${t.accentSoft};
  --font-display:${t.fontDisplay};
  --font-body:${t.fontBody};
  --dur-base:${t.durBase};
  --dur-slow:${t.durSlow};
  --r-card:${t.rCard};
  --rule-style:${t.ruleStyle};
}
html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:var(--font-body)}`;
}

// ─── System prompt for animation generation ────────────────────────────────

const ANIMATION_SYSTEM_PROMPT = `你是一位資深的教學影片動畫工程師，遵循「影片感 > PPT 感」設計哲學，專門為 16:9 簡報頁面製作「內容感知解說動畫」。

━━━ 輸出格式硬性規定 ━━━
• 只輸出完整 HTML（<!DOCTYPE html> 開頭），不附任何說明文字
• ⛔ 禁止 Markdown：不得輸出 \`\`\`html、\`\`\` 或任何代碼圍欄
• 無外部依賴（無 CDN、無 import、無 fetch），純 HTML + CSS + JS
• 頁面：width:100%; height:100vh; 感知 16:9 比例
• 動畫：載入後立即自動播放，3~5 秒內完成一輪敘事後定格

━━━ 最低品質門檻（低於此標準 = 廢棄）━━━
• 至少 3 個有關聯的動畫階段（入場 → 演示 → 定格），不可只有 1~2 條靜態線
• 主視覺必須是下列之一且做滿：SVG 路徑自繪、多節點流程點亮、柱狀/折線生長、數字 counter、卡片聚攏/展開
• 畫面至少 4 個語意圖形元素（path/circle/rect/node 等），有層次與景深
• 至少 2 種動效手段（@keyframes + transform / stroke-dashoffset / JS 計數 等）
• 主視覺區佔 viewport 高度 ≥ 55%

━━━ 版面鐵則（違反 = 輸出廢棄） ━━━
• 整頁只有「圖形演示區」一個主區塊 —— 禁止獨立的文字說明區、段落區、字幕區
• 外層簡報版型已顯示螢幕標題時，iframe 內不得再重複標題或口播句子
• 裝飾性背景（光暈、紋理、粒子底層）只能放在 z-index:0 的 ::before/::after 或獨立背景 div，並設 pointer-events:none
• 禁止對資訊性文字使用 position:absolute 堆疊長段落
• 任何 overflow 不得溢出 viewport
• 【文字字數上限】整個動畫頁面所有可見文字加總 ≤ 16 字；圖表軸標籤 ≤ 4 字；不得有句子或段落
• 禁止出現 [口播]、[畫面]、voiceover、narration 等內部標記字樣

━━━ 影片感三項硬標準 ━━━
• **不像 PPT** — 不得有頁首 / 頁尾 / 品牌條 / 分割線頁碼；主視覺佔畫面 > 50%
• **字號要大** — hero 文字（主標語 / 主數字 / 核心關鍵詞）字級 ≥ 80px；輔助文字 ≥ 24px；不得出現 < 18px 的資訊性文字
• **留白要多** — 四邊 padding ≥ 60px；圖形演示區與文字說明區之間 gap ≥ 24px；畫面絕對不塞滿

━━━ 核心設計哲學：畫面在「演事情」，不是打字幕 ━━━
每個動畫必須「讓觀眾看見口播在說的事情發生」：
  · 說「生長」就讓橫條 scaleX 0→1、說「連接」就讓 SVG 路徑 stroke-dashoffset 自繪
  · 說「遞增」就讓數字 counter 從 0 滾動到目標值
  · 說「對比」就讓畫面一分為二、兩邊依序亮起
  · 說「流程」就讓節點逐步點亮 + 連線自繪
  · 說「轉換 / 變形」就讓形狀 clip-path 或 transform 過渡
  · 說「數據」就讓柱狀圖各列錯落生長、說「比例」就讓圓弧 stroke 自畫
  · 「反差對照」→ 一刀切開畫面兩半各自亮起
  · 「遞進列表」→ 節點依序點亮 + 上一項灰化
  · 「金句 / 強調」→ 超大 hero 字 + 關鍵詞 clip-reveal 入場
  · 「聚合 / 彙總」→ 粒子 / 小卡片聚攏成主形狀

如果口播的核心動詞是「介紹 / 說明 / 就是」→ 不要直接把介紹文字全排上去，
而要找一個可以「演」的視覺隱喻（流程、對比、分解、聚合、計數）來承載它。

━━━ 動畫節奏要跟主題 mood 匹配 ━━━
• var(--dur-base) 是主題節奏基準；--dur-base > 700ms = 慢主題，別寫 200ms 的入場動畫
• 慢主題（serif / 電影感）用長 ease-out、優雅過渡；快主題（bauhaus / neon）可用 snappy spring
• 動畫完成後畫面穩定靜止 —— 不得持續呼吸 / 閃爍 / 搖擺（持續微動只有明確需要時才加）

━━━ 主題 token 使用規則 ━━━
• 你在 user prompt 裡拿到了 <theme-css> 標籤包住的 CSS :root{} 塊
• 把這段 CSS 原封不動放入 HTML 的 <head><style> 頂部
• 所有顏色必須走 var(--bg) / var(--surface) / var(--text) / var(--accent) 等變數
• 所有字型必須走 var(--font-display) / var(--font-body)
• 所有動畫時長基準用 var(--dur-base) / var(--dur-slow)
• 禁止在 CSS 中硬編任何顏色（#xxx / rgb() / hsl()）—— 只有裝飾性純幾何形狀（無語意色彩的 SVG 幾何）可以用 currentColor 或 accent

━━━ ANTI-AI 黑名單（全部禁止）━━━
• 紫粉 / 藍紫對角漸變背景
• 圓角卡片 + 彩色左邊框裝飾條
• 漸變按鈕 + 大圓角藥丸
• emoji 當圖示 / 假 logo / 假數據
• 全場只用 opacity 0→1 fade 作唯一動畫
• 每屏右下角掛 mono 角標 / 序號
• 持續循環閃爍光暈 / 呼吸光暈 / ken burns（除非內容明確需要）
• 彩虹漸層 / 超過兩個主色
• 頁首 / 頁尾 / 品牌條 / 任何形式的 header 或 footer
• 「感謝收看」「謝謝觀看」等片尾語 / 無關步驟序號（單獨放大 1、2、3）
• ⛔ 把「概念提示」的原文逐字搬到畫面上 —— 這是最嚴重的失誤，無論如何不得這樣做
• ⛔ 顯示任何超過 8 個字的文字句子或段落`;

function buildAnimationUserPrompt(ctx: {
  chapterTitle: string;
  scriptSnippet: string;
  screenSnippet: string;
  animationPrompt?: string;
  visualHint?: string;
  themeId: string;
  chapterKind?: string;
  outerScreenShown?: boolean;
}): string {
  const profile = THEME_DATA[ctx.themeId] ?? THEME_DATA["midnight-press"]!;
  const themeCss = buildThemeCss(ctx.themeId);

  return `<theme-css>
${themeCss}
</theme-css>

主題視覺個性（設計氣質參考）：${profile.personality}

章節主題：${ctx.chapterTitle}

${ctx.visualHint ? `步驟視覺關係（「演什麼動作」的提示，例如「反差對照」「遞進列表」「金句強調」）：${ctx.visualHint}\n\n` : ""}${ctx.outerScreenShown && ctx.screenSnippet ? `【外層版型已顯示螢幕標題】「${ctx.screenSnippet}」—— 動畫內禁止重複此標題，也禁止口播原文。\n\n` : ""}${ctx.chapterKind === "list-reveal" ? `【清單揭示版型】外層已顯示螢幕短標，iframe 只允許純圖形演示（圖表、流程、對比動畫），不得有說明段落。\n\n` : ""}【概念提示 — 只告訴你要「演什麼概念」，這段文字絕對不能直接顯示在畫面上】
${ctx.scriptSnippet}

畫面補充說明：${ctx.screenSnippet || "無"}

${ctx.animationPrompt ? `使用者指定動畫方向：\n${ctx.animationPrompt}\n` : ""}請根據上方概念，設計一個「高質感純視覺演示動畫」——找一個具體、可演的動態隱喻（流程節點依序點亮、卡片聚攏置中、柱狀圖錯落生長、路徑自繪、數字 counter 等），至少 3 段動畫節拍。動畫內可見文字總字數 ≤ 16 字，不得有句子或段落，不得出現 [口播]/[畫面]/感謝收看/步驟序號。直接輸出 <!DOCTYPE html> 開頭的完整 HTML（禁止 \`\`\`html 圍欄），把 <theme-css> 原封不動放在 <head><style> 頂部。`;
}

const RETRY_ISSUE_HINT: Partial<Record<string, string>> = {
  "markdown-leak": "上次輸出含 ```html 標記。這次直接從 <!DOCTYPE html> 開始，禁止任何 Markdown。",
  "too-simple": "上次動畫太簡陋。這次必須有 SVG 路徑動畫或多節點流程，至少 3 段動畫節拍、4 個以上圖形元素。",
  "placeholder-text": "上次出現感謝收看或無關數字。這次禁止片尾語與步驟序號，只做與概念相關的視覺演示。",
  "script-leak": "上次把口播原文放上畫面。這次只做抽象圖形動畫，不得顯示口播句子。",
};

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wvpChapterId: string }> },
) {
  const { id, wvpChapterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  // Load project and craft
  const { data: project } = await supabase
    .from("projects")
    .select("title, wvp_settings, wvp_phase_locks, phase_locks")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const { data: craft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .maybeSingle();
  if (!craft) return NextResponse.json({ error: "章節不存在" }, { status: 404 });

  // Parse body
  const body = (await req.json().catch(() => ({}))) as {
    stepIndex?: number;
    animationPrompt?: string;
  };
  const stepIndex = typeof body.stepIndex === "number" ? body.stepIndex : undefined;
  if (stepIndex === undefined || stepIndex < 0) {
    return NextResponse.json({ error: "缺少 stepIndex" }, { status: 400 });
  }

  // Resolve text LLM provider
  const configured = await listConfiguredLlmProviders(supabase, user.id);
  const textProvider = configured[0];
  if (!textProvider) {
    return NextResponse.json({ error: "尚未設定 LLM API Key，請前往設定頁面配置" }, { status: 400 });
  }
  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key, default_model, text_model")
    .eq("user_id", user.id)
    .eq("provider", textProvider)
    .maybeSingle();
  if (!keyRow?.encrypted_key) {
    return NextResponse.json({ error: "找不到 API Key" }, { status: 400 });
  }
  const apiKey = decryptApiKey(keyRow.encrypted_key);

  // Build step context from composition
  const composition = await loadProjectComposition(supabase, id);
  if (!composition) {
    return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
  }
  const chapter = resolveCompositionChapterForCraft(composition, craft);
  const narrations = chapter ? narrationsForChapter(composition, chapter.id) : [];
  const wvpSteps = chapter ? orderedWvpStepsForChapter(composition, chapter.id) : [];
  const screenContents = chapter ? screenContentsForChapter(composition, chapter.id) : [];

  const script = (wvpSteps[stepIndex]?.script ?? narrations[stepIndex] ?? "").trim();
  const screen = (screenContents[stepIndex] ?? "").trim();
  const chapterKind = chapter
    ? chapterKindForCraft(
        composition,
        chapter.id,
        craft.title ?? chapter.title,
        narrations,
        (craft.checklist_result as { aiPlan?: Record<string, unknown> } | null)?.aiPlan,
      )
    : undefined;

  // Extract dominantAction (step-level visual relationship hint) from craft AI plan
  const aiPlan = craft.checklist_result as { stepBeats?: { step: number; dominantAction?: string }[] } | null;
  const visualHint = aiPlan?.stepBeats?.find((b) => b.step === stepIndex)?.dominantAction?.trim() || undefined;

  if (!script && !screen && !body.animationPrompt) {
    return NextResponse.json({ error: "此步驟缺少口播與畫面說明" }, { status: 400 });
  }

  // Build OpenAI client
  const baseURL =
    textProvider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : textProvider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta/openai/"
        : undefined;
  const openai = new OpenAI({ apiKey, baseURL });
  // 使用使用者設定的模型，並依 provider 使用正確的後備值（修正 Gemini 誤用 gpt-4o 的問題）
  const model = resolveEffectiveTextModel(
    textProvider,
    (keyRow as { text_model?: string | null }).text_model,
    (keyRow as { default_model?: string | null }).default_model,
  );

  // Resolve theme id
  const themeId = (project.wvp_settings as { themeId?: string } | null)?.themeId ?? "midnight-press";

  const userPrompt = buildAnimationUserPrompt({
    chapterTitle: craft.title ?? project.title ?? "課程",
    scriptSnippet: script.slice(0, 150),
    screenSnippet: screen.slice(0, 80),
    animationPrompt: body.animationPrompt,
    visualHint,
    themeId,
    chapterKind,
    outerScreenShown: Boolean(screen),
  });

  let animationHtml = "";
  let lastIssue: ReturnType<typeof inspectAnimationHtml> = "not-html";
  let dslSource: "infer" | "llm" | null = null;

  // DSL 優先：啟發式匹配成功則用規則引擎渲染，跳過 LLM
  if (!body.animationPrompt?.trim()) {
    const inferred = inferExplainAnimation(script, screen, visualHint);
    if (inferred) {
      animationHtml = renderExplainAnimationHtml(inferred.config, { themeId });
      lastIssue = inspectAnimationHtml(animationHtml, { script, screen });
      if (!lastIssue) {
        dslSource = "infer";
      } else {
        animationHtml = "";
        lastIssue = "not-html";
      }
    }
  }

  try {
    if (dslSource === "infer") {
      // 已由 DSL 產出，略過 LLM
    } else {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: ANIMATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await openai.chat.completions.create({
        model,
        messages,
        temperature: attempt === 0 ? 0.65 : 0.45,
        max_tokens: 5000,
      });
      const raw = res.choices[0]?.message?.content?.trim() ?? "";
      animationHtml = extractAnimationHtml(raw);
      lastIssue = inspectAnimationHtml(animationHtml, { script, screen });
      if (!lastIssue) break;
      const hint = RETRY_ISSUE_HINT[lastIssue];
      if (!hint || attempt === 1) break;
      messages.push(
        { role: "assistant", content: raw },
        { role: "user", content: `輸出不合格：${animationHtmlIssueMessage(lastIssue)}\n${hint}` },
      );
    }
    if (lastIssue) {
      return NextResponse.json(
        { error: animationHtmlIssueMessage(lastIssue) },
        { status: 422 },
      );
    }
    if (!dslSource) dslSource = "llm";
    }
  } catch (e) {
    return NextResponse.json(
      { error: `動畫生成失敗：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  // Persist animation HTML in DB
  await patchChapterIllustrationPrompts(supabase, user.id, id, craft, [
    {
      stepIndex,
      imageSource: "animation",
      animationHtml,
    },
  ]);

  // Write animation HTML to local presentation folder (best-effort)
  try {
    const presentationDir = presentationDirForProject(id);
    await writePresentationAnimationFile(presentationDir, wvpChapterId, stepIndex, animationHtml);
  } catch {
    // Non-fatal — presentation might not be scaffolded yet
  }

  // Return updated state
  const { data: updatedCraft } = await supabase
    .from("chapter_craft")
    .select("*")
    .eq("project_id", id)
    .eq("wvp_chapter_id", wvpChapterId)
    .single();

  if (!updatedCraft) {
    return NextResponse.json({ ok: true, animationHtml });
  }

  const state = await getChapterIllustrationsState(
    supabase,
    user.id,
    id,
    updatedCraft,
    composition,
  );
  return NextResponse.json({ ok: true, animationHtml, dslSource, ...state });
}
