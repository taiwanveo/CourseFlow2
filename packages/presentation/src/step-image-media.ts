/** WVP 步驟配圖副檔名（小寫、不含點） */
export type WvpStepImageExt = "jpg" | "jpeg" | "png" | "bmp" | "gif";

export const WVP_STATIC_IMAGE_EXTS: WvpStepImageExt[] = ["jpg", "jpeg", "png", "bmp"];
export const WVP_ANIMATED_IMAGE_EXTS: WvpStepImageExt[] = ["gif"];
/** APNG 以 PNG 容器儲存，副檔名仍為 png */
export const WVP_UPLOAD_ACCEPT = [
  ...WVP_STATIC_IMAGE_EXTS,
  ...WVP_ANIMATED_IMAGE_EXTS,
  "png",
].join(",");

const EXT_SET = new Set<string>(["jpg", "jpeg", "png", "bmp", "gif"]);

export function normalizeStepImageExt(ext: string): WvpStepImageExt {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "jfif") return "jpg";
  if (EXT_SET.has(e)) return e as WvpStepImageExt;
  return "jpg";
}

export function wvpStepImageFileName(stepIndex0: number, ext: WvpStepImageExt = "jpg"): string {
  return `${String(stepIndex0 + 1).padStart(2, "0")}.${ext}`;
}

export function wvpStepImageRelPath(
  wvpChapterId: string,
  stepIndex0: number,
  ext: WvpStepImageExt = "jpg",
): string {
  return `images/${wvpChapterId}/${wvpStepImageFileName(stepIndex0, ext)}`;
}

export function contentTypeForStepImageExt(ext: WvpStepImageExt): string {
  switch (ext) {
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "bmp":
      return "image/bmp";
    case "jpeg":
      return "image/jpeg";
    default:
      return "image/jpeg";
  }
}

export function detectStepImageExtFromBuffer(buf: Buffer): WvpStepImageExt {
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  return "jpg";
}

export function detectStepImageExtFromMime(mime: string, fileName?: string): WvpStepImageExt {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/gif") return "gif";
  if (m === "image/png") return "png";
  if (m === "image/bmp" || m === "image/x-ms-bmp") return "bmp";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (fileName?.includes(".")) {
    const ext = fileName.split(".").pop() ?? "";
    return normalizeStepImageExt(ext);
  }
  return "jpg";
}

export function isAllowedUploadImage(file: { type: string; name: string }): boolean {
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : "";
  if (EXT_SET.has(ext.toLowerCase())) return true;
  const m = file.type.toLowerCase();
  return (
    m === "image/jpeg" ||
    m === "image/png" ||
    m === "image/gif" ||
    m === "image/bmp" ||
    m === "image/x-ms-bmp"
  );
}
