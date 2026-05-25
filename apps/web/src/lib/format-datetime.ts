/** 固定 UTC+8 格式，避免 SSR 與瀏覽器 toLocaleString 空白字元不一致造成 hydration mismatch */
export function formatProjectDateTime(iso: string): string {
  const ms = new Date(iso).getTime();
  const taipei = new Date(ms + 8 * 60 * 60 * 1000);
  const y = taipei.getUTCFullYear();
  const m = taipei.getUTCMonth() + 1;
  const day = taipei.getUTCDate();
  let h = taipei.getUTCHours();
  const min = String(taipei.getUTCMinutes()).padStart(2, "0");
  const sec = String(taipei.getUTCSeconds()).padStart(2, "0");
  const period = h < 12 ? "上午" : "下午";
  h = h % 12 || 12;
  return `${y}/${m}/${day} ${period}${h}:${min}:${sec}`;
}
