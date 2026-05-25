export type {
  ThemeApplyMeta,
  ThemeTokenSnapshot,
} from "@courseflow/core";
export { applyThemeToComposition } from "@courseflow/core";

/** 客戶端主題選項（由 /api/themes 回傳） */
export type ClientThemeOption = import("@courseflow/core").ThemeApplyMeta & {
  name?: string;
  description?: string;
  descriptionZh?: string;
  preview: {
    shell: string;
    surface: string;
    text: string;
    accent: string;
  };
};
