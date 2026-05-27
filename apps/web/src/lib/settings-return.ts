export const SETTINGS_RETURN_KEY = "courseflow:settings-return-to";

/** 進入設定頁前記住目前路徑，供「返回上一頁」使用 */
export function rememberSettingsReturnPath(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SETTINGS_RETURN_KEY,
    `${window.location.pathname}${window.location.search}`,
  );
}
