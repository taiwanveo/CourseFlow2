"use client";

const STORAGE_KEY = "courseflow-browser-notify";

export function isBrowserNotifyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBrowserNotifyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function requestBrowserNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** 分頁在背景或使用者已啟用時，發送桌面通知 */
export function maybeBrowserNotify(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!isBrowserNotifyEnabled() && !document.hidden) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body: body.slice(0, 240),
      tag: "courseflow-task",
    });
  } catch {
    /* ignore */
  }
}
