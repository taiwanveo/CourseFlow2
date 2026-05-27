/** 章節標題 → WVP 資料夾 id（小寫連字符） */
export function titleToWvpChapterId(title: string, fallbackIndex: number): string {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii && /^[a-z0-9][a-z0-9-]*$/.test(ascii)) return ascii.slice(0, 48);
  return `chapter-${String(fallbackIndex + 1).padStart(2, "0")}`;
}
