export type LlmProviderId = "openai" | "gemini" | "openrouter";

export interface LlmCredentials {
  provider: LlmProviderId;
  apiKey: string;
  model?: string;
}

export interface GeneratedChapter {
  title: string;
  /** WVP 章節 id（小寫連字符），對應 presentation/src/chapters/ */
  wvpChapterId?: string;
  sortOrder: number;
  children?: GeneratedChapter[];
  /** 章節級信息池（雙源原則） */
  chapterInfoPool?: string[];
  /**
   * 章節分隔頁的口播稿（搭配 [章節標題] 螢幕文字）。
   * 對應資料結構中的 {章節N標題口播稿}。
   */
  chapterScript?: string;
  /** coldopen | outro | undefined（一般章節） */
  chapterKind?: string;
  steps: GeneratedStep[];
}

export interface GeneratedStep {
  screenContent: string;
  infoPool: string[];
  estimatedSeconds: number;
  /** 內容關係提示，非動畫規格 */
  relationHint?: string;
  script?: string;
}

export interface GeneratedOutline {
  chapters: GeneratedChapter[];
  summary: string;
}
