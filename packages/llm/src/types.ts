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
