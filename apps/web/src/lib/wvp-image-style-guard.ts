import { isValidImageStyleId } from "@/lib/image-style.server";
import { parseWvpSettings, requireWvpImageStyle, type WvpSettings } from "@/lib/wvp-settings";

export type ImageStyleGuardResult =
  | {
      ok: true;
      settings: WvpSettings;
      /** BananaX 風格 id；若使用者未選則為 "theme-default" */
      imageStyleId: string;
    }
  | {
      ok: false;
      error: string;
      status: 400;
    };

/**
 * 驗證並解析生圖風格設定。
 * - 若選了 BananaX 風格 → 驗證 id 仍存在於目錄。
 * - 若未選（null / undefined）→ 允許通過，imageStyleId 設為 "theme-default"，
 *   由呼叫方負責從 themeId 生成 styleFragment。
 */
export function assertProjectImageStyleConfigured(
  wvpSettingsRaw: unknown,
): ImageStyleGuardResult {
  const settings = parseWvpSettings(wvpSettingsRaw);
  const imageStyle = requireWvpImageStyle(settings);

  if (imageStyle) {
    if (!isValidImageStyleId(imageStyle.id)) {
      return {
        ok: false,
        error: "所選生圖風格已不存在，請重新選擇或清除風格以使用主題預設",
        status: 400,
      };
    }
    return { ok: true, settings, imageStyleId: imageStyle.id };
  }

  // 未選 BananaX 風格 → 使用主題預設，不阻擋流程
  return { ok: true, settings, imageStyleId: "theme-default" };
}
