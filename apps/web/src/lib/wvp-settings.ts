import type { WvpDevMode } from "@courseflow/core";

export interface WvpAssetRef {
  wvpChapterId?: string;
  step?: number;
  url: string;
  alt?: string;
}

export interface WvpAnchorProfile {
  wvpChapterId: string;
  chapterTitle: string;
  themeId?: string;
  templateKind?: string;
  vizTypes?: string[];
  tsxExcerpt?: string;
  approvedAt?: string;
}

/** 使用者於視覺動效階段選定的 AI 生圖風格（BananaX 精選目錄） */
export interface WvpImageStyleSelection {
  id: string;
  titleZh: string;
  source: "bananax-infographic-evaluation";
}

export interface WvpSettings {
  themeId?: string | null;
  devMode?: WvpDevMode;
  materialsNotes?: string;
  anchorChapterApproved?: boolean;
  /** 已完成第 1 章試執行（可預覽） */
  anchorChapterTrialCompleted?: boolean;
  anchorProfile?: WvpAnchorProfile;
  assets?: WvpAssetRef[];
  imageStyle?: WvpImageStyleSelection | null;
}

export function parseWvpSettings(raw: unknown): WvpSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const assets = Array.isArray(o.assets)
    ? (o.assets as WvpAssetRef[]).filter((a) => a && typeof a.url === "string")
    : undefined;
  const anchorProfile =
    o.anchorProfile && typeof o.anchorProfile === "object"
      ? (o.anchorProfile as WvpAnchorProfile)
      : undefined;
  let imageStyle: WvpImageStyleSelection | null | undefined;
  if (o.imageStyle === null) {
    imageStyle = null;
  } else if (o.imageStyle && typeof o.imageStyle === "object") {
    const s = o.imageStyle as Record<string, unknown>;
    if (
      typeof s.id === "string" &&
      typeof s.titleZh === "string" &&
      s.source === "bananax-infographic-evaluation"
    ) {
      imageStyle = {
        id: s.id,
        titleZh: s.titleZh,
        source: "bananax-infographic-evaluation",
      };
    }
  }
  return {
    themeId: typeof o.themeId === "string" ? o.themeId : null,
    devMode:
      o.devMode === "per-chapter" ||
      o.devMode === "sequential" ||
      o.devMode === "parallel"
        ? o.devMode
        : "sequential",
    materialsNotes: typeof o.materialsNotes === "string" ? o.materialsNotes : "",
    anchorChapterApproved: Boolean(o.anchorChapterApproved),
    anchorChapterTrialCompleted: Boolean(o.anchorChapterTrialCompleted),
    anchorProfile,
    assets,
    imageStyle,
  };
}

/** 批次產生章節畫面前必須已選生圖風格 */
export function requireWvpImageStyle(
  settings: WvpSettings,
): WvpImageStyleSelection | null {
  const id = settings.imageStyle?.id?.trim();
  if (!id || !settings.imageStyle?.titleZh) return null;
  return settings.imageStyle;
}
