export type ResponsePayload = Record<string, unknown> & {
  error?: string;
  rawText?: string;
};

/** 安全讀取 fetch 回應；空 body 或非 JSON 不會拋出 SyntaxError。 */
export async function readResponsePayload(response: Response): Promise<ResponsePayload> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as ResponsePayload) : { rawText: text };
  } catch {
    return { rawText: text };
  }
}

export function isLikelyHtmlResponse(response: Response, payload: ResponsePayload): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) return true;
  if (response.redirected && response.url.includes("/login")) return true;
  return typeof payload.rawText === "string" && /^\s*<!doctype html/i.test(payload.rawText);
}

export function getFetchErrorMessage(
  response: Response,
  payload: ResponsePayload,
  fallback: string,
): string {
  if (isLikelyHtmlResponse(response, payload)) {
    return "登入狀態已失效，請重新登入後再試。";
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload.rawText === "string" && payload.rawText.trim()) {
    return payload.rawText;
  }
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  return `${fallback}（HTTP ${response.status}${statusText}）`;
}

/** 生圖 API 在閘道逾時時常見的空 body / 5xx 狀態。 */
export const TRANSIENT_HTTP_STATUS = new Set([502, 503, 504, 524]);
