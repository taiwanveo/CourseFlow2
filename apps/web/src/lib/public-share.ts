import { randomBytes } from "node:crypto";

/** 產生學員分享用 slug（英數，避免中文 URL 編碼問題） */
export function generatePublicShareSlug(): string {
  return `watch-${randomBytes(5).toString("hex")}`;
}

export function publicWatchPath(slug: string, opts?: { auto?: boolean }): string {
  const base = `/watch/${encodeURIComponent(slug)}`;
  if (opts?.auto) return `${base}?auto=1`;
  return base;
}

export function publicWatchEmbedBase(slug: string): string {
  return `/watch/${encodeURIComponent(slug)}/embed/`;
}

export function absolutePublicWatchUrl(origin: string, slug: string, auto = true): string {
  const path = publicWatchPath(slug, { auto });
  return `${origin.replace(/\/$/, "")}${path}`;
}
