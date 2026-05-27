import { isValidImageStyleId } from "@/lib/image-style.server";
import { parseWvpSettings, requireWvpImageStyle, type WvpSettings } from "@/lib/wvp-settings";

export function assertProjectImageStyleConfigured(
  wvpSettingsRaw: unknown,
): { ok: true; settings: WvpSettings; imageStyle: NonNullable<ReturnType<typeof requireWvpImageStyle>> } | {
  ok: false;
  error: string;
  status: 400;
} {
  const settings = parseWvpSettings(wvpSettingsRaw);
  const imageStyle = requireWvpImageStyle(settings);
  if (!imageStyle) {
    return {
      ok: false,
      error: "請先在「2. 視覺動效」選擇生圖風格主題後再執行",
      status: 400,
    };
  }
  if (!isValidImageStyleId(imageStyle.id)) {
    return {
      ok: false,
      error: "所選生圖風格已不存在，請重新選擇",
      status: 400,
    };
  }
  return { ok: true, settings, imageStyle };
}
