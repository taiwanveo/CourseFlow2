/**
 * CourseFlow 配圖排列規則（全 23 主題共用，與主題 tokens 無關）：
 * 1. 單圖 → 置中
 * 2. 單圖 + 文字 → 上下分區，圖不蓋字
 * 3. 雙圖 → 左右各半
 * 4. 三圖 → 三等分，中欄為對齊中心
 * 5. 四圖 → 田字格 2×2
 * 6. 鐵律：圖片與文字絕不重疊
 */

/** 依圖片數量回傳 cf-img-grid 修飾 class（1–4；超過 4 以田字格容納前 4 格） */
export function imageGridCountClass(count: number): string {
  const n = Math.max(1, Math.min(4, count));
  return `cf-img-grid--n${n}`;
}
