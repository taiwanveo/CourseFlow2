export type ThemeGalleryMeta = {
  id: string;
  imageUrl: string;
  subtitleZh: string;
  bestForZh: string;
};

const LOCAL_BASE = "/assets/theme-gallery";

const FALLBACK_IMAGE = `${LOCAL_BASE}/paper-press.webp`;

const THEME_GALLERY: Record<string, Omit<ThemeGalleryMeta, "id">> = {
  "midnight-press": {
    imageUrl: `${LOCAL_BASE}/midnight-press.webp`,
    subtitleZh: "電影感編輯暗底，暖暗底加上橙色焦點",
    bestForZh: "適合：開發者教學、AI 工具評測、技術深度解析",
  },
  "dark-botanical": {
    imageUrl: `${LOCAL_BASE}/dark-botanical.webp`,
    subtitleZh: "高級時尚刊物感，陶土與玫粉層次",
    bestForZh: "適合：品牌故事、高端產品發布、風格型內容",
  },
  "chalk-garden": {
    imageUrl: `${LOCAL_BASE}/chalk-garden.webp`,
    subtitleZh: "黑板粉筆風格，手寫質感清楚親切",
    bestForZh: "適合：科普教學、初學者引導、課堂講解",
  },
  blueprint: {
    imageUrl: `${LOCAL_BASE}/blueprint.webp`,
    subtitleZh: "工程藍圖語言，網格與製圖感鮮明",
    bestForZh: "適合：系統架構、API 說明、流程拆解",
  },
  "terminal-green": {
    imageUrl: `${LOCAL_BASE}/terminal-green.webp`,
    subtitleZh: "復古終端機綠色調，等寬字型氣質",
    bestForZh: "適合：CLI 教學、安全議題、技術致敬",
  },
  "neon-cyber": {
    imageUrl: `${LOCAL_BASE}/neon-cyber.webp`,
    subtitleZh: "霓虹賽博風格，強對比電光色",
    bestForZh: "適合：未來主題、AI 話題、科技宣傳",
  },
  "bold-signal": {
    imageUrl: `${LOCAL_BASE}/bold-signal.webp`,
    subtitleZh: "Pitch Deck 主舞台感，重點對比強",
    bestForZh: "適合：產品發布、簡報宣言、路演",
  },
  "creative-voltage": {
    imageUrl: `${LOCAL_BASE}/creative-voltage.webp`,
    subtitleZh: "飽和電光視覺，創意導向強烈",
    bestForZh: "適合：設計分享、工作室展示、創意提案",
  },
  "paper-press": {
    imageUrl: `${LOCAL_BASE}/paper-press.webp`,
    subtitleZh: "亮色印刷風，紙感溫暖且易讀",
    bestForZh: "適合：雜誌型內容、生活風主題、一般教學",
  },
  newsroom: {
    imageUrl: `${LOCAL_BASE}/newsroom.webp`,
    subtitleZh: "報社編輯感，資訊密度與秩序平衡",
    bestForZh: "適合：報導敘事、時事解析、深度評測",
  },
  "monochrome-print": {
    imageUrl: `${LOCAL_BASE}/monochrome-print.webp`,
    subtitleZh: "黑白印刷風格，克制與專注並重",
    bestForZh: "適合：學術解讀、觀點評論、嚴謹內容",
  },
  "vintage-editorial": {
    imageUrl: `${LOCAL_BASE}/vintage-editorial.webp`,
    subtitleZh: "復古編輯語言，幾何層次豐富",
    bestForZh: "適合：文化隨筆、設計主題、個人觀點",
  },
  "sunset-zine": {
    imageUrl: `${LOCAL_BASE}/sunset-zine.webp`,
    subtitleZh: "拼貼雜誌調性，暖色活潑有節奏",
    bestForZh: "適合：創意分享、生活向內容、輕敘事",
  },
  "pastel-dream": {
    imageUrl: `${LOCAL_BASE}/pastel-dream.webp`,
    subtitleZh: "柔和粉彩風，親和且舒適",
    bestForZh: "適合：入門導覽、友善教學、陪伴型內容",
  },
  "warm-keynote": {
    imageUrl: `${LOCAL_BASE}/warm-keynote.webp`,
    subtitleZh: "現代 Keynote 風，清楚且有舞台感",
    bestForZh: "適合：SaaS 產品介紹、對外簡報、發表會",
  },
  "electric-studio": {
    imageUrl: `${LOCAL_BASE}/electric-studio.webp`,
    subtitleZh: "企業簡報語言，清爽且專業",
    bestForZh: "適合：B2B 說明、商務提案、季度更新",
  },
  "bauhaus-bold": {
    imageUrl: `${LOCAL_BASE}/bauhaus-bold.webp`,
    subtitleZh: "包浩斯宣言風格，造型俐落直接",
    bestForZh: "適合：觀點主張、品牌發布、產品亮點",
  },
  "swiss-ikb": {
    imageUrl: `${LOCAL_BASE}/swiss-ikb.webp`,
    subtitleZh: "瑞士風資訊層級，理性且精準",
    bestForZh: "適合：技術彙報、數據展示、專業分享",
  },
  dune: {
    imageUrl: `${LOCAL_BASE}/dune.webp`,
    subtitleZh: "沙丘色系，高級畫冊質感",
    bestForZh: "適合：品牌畫冊、空間主題、藝術敘事",
  },
  "indigo-porcelain": {
    imageUrl: `${LOCAL_BASE}/indigo-porcelain.webp`,
    subtitleZh: "靛藍瓷白對比，沉穩清晰",
    bestForZh: "適合：學術內容、技術講解、研究分享",
  },
  "forest-ink": {
    imageUrl: `${LOCAL_BASE}/forest-ink.webp`,
    subtitleZh: "森林墨色調，自然且具深度",
    bestForZh: "適合：紀錄敘事、永續議題、慢節奏內容",
  },
  "kraft-paper": {
    imageUrl: `${LOCAL_BASE}/kraft-paper.webp`,
    subtitleZh: "牛皮紙紋理，復古溫度明顯",
    bestForZh: "適合：書評文史、手作主題、風格內容",
  },
  "split-canvas": {
    imageUrl: `${LOCAL_BASE}/split-canvas.webp`,
    subtitleZh: "雙色畫布，對照關係直覺",
    bestForZh: "適合：雙主題比較、辯論結構、概念對照",
  },
};

export function resolveThemeGalleryMeta(
  id: string,
  fallbackTitle: string,
  fallbackDescription?: string,
): ThemeGalleryMeta {
  const hit = THEME_GALLERY[id];
  if (hit) return { id, ...hit };
  return {
    id,
    imageUrl: `${LOCAL_BASE}/${id}.webp`,
    subtitleZh: fallbackDescription?.trim() || `${fallbackTitle} 主題預覽`,
    bestForZh: "適合：一般教學簡報與內容展示",
  };
}

export const themeGalleryFallbackImage = FALLBACK_IMAGE;
