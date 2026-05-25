/** CHAPTER-CRAFT 完工自檢 — 機器可讀項目（對應 docs/checklist.schema.json） */

export interface ChecklistItemResult {
  id: string;
  label: string;
  passed: boolean;
  evidence?: string;
  suggestion?: string;
}

export interface ChapterChecklistResult {
  chapterId: string;
  passed: boolean;
  items: ChecklistItemResult[];
}

export const CHAPTER_CRAFT_CHECKLIST_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "visual-demo", label: "每章至少 1~2 處 CSS/SVG/Canvas/JS 視覺演示" },
  { id: "step-variety", label: "不同 step 的主導動作不一樣" },
  { id: "typography", label: "字號大、留白舒服、配色舒服" },
  { id: "list-reveal", label: "清單/列表 1 項 = 1 step" },
  { id: "dual-source", label: "畫面資訊比口播稿多（有回 article 抽細節）" },
  { id: "anti-ai", label: "無紫粉漸層/圓角彩框/emoji/假數據/假 logo" },
  { id: "placeholders", label: "缺素材用 placeholder，非 fake" },
  { id: "tokens", label: "顏色與字體家族走 token；primitive class 接入主題" },
  { id: "no-header-footer", label: "無頁眉頁腳式 chrome" },
  { id: "no-wall-of-text", label: "禁止大量純文字與過小字級" },
  { id: "tsc", label: "npx tsc --noEmit 通過" },
  { id: "isolation", label: "章節獨立 CSS 前綴、未跨章 import" },
  { id: "narrations-length", label: "narrations.length === 最大 step + 1" },
  { id: "narrations-script", label: "narration 與 script.md 語義一致" },
  { id: "anim-duration", label: "每 step 視覺動畫時長 ≤ 口播時長" },
] as const;

export function emptyChapterChecklist(chapterId: string): ChapterChecklistResult {
  return {
    chapterId,
    passed: false,
    items: CHAPTER_CRAFT_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      passed: false,
    })),
  };
}

export function mergeChecklistResults(
  chapterId: string,
  evaluated: ChecklistItemResult[],
): ChapterChecklistResult {
  const byId = new Map(evaluated.map((e) => [e.id, e]));
  const items = CHAPTER_CRAFT_CHECKLIST_ITEMS.map((def) => {
    const hit = byId.get(def.id);
    return hit ?? { ...def, passed: false, suggestion: "尚未檢查" };
  });
  return {
    chapterId,
    passed: items.every((i) => i.passed),
    items,
  };
}
