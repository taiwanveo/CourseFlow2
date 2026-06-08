/** 瀏覽器端主題預覽圖記憶體快取（切換主題時不重複顯示載入動畫） */
const loadedUrls = new Set<string>();

export function isThemePreviewCached(url: string): boolean {
  return loadedUrls.has(url);
}

export function markThemePreviewCached(url: string): void {
  loadedUrls.add(url);
}

export function preloadThemePreviewUrl(url: string): void {
  if (typeof window === "undefined" || !url || loadedUrls.has(url)) return;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => markThemePreviewCached(url);
  img.onerror = () => {
    /* 預載失敗不標記，讓正式 <img> 再試 */
  };
  img.src = url;
}
