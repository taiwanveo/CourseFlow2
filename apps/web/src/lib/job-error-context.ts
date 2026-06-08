/** 長任務失敗時組合可讀的 context（章節／步驟／API 原文） */

export type JobStepError = {
  stepIndex?: number;
  stepLabel?: string;
  chapterTitle?: string;
  error?: string;
};

export function formatJobStepError(err: JobStepError): string {
  const parts: string[] = [];
  if (err.chapterTitle) parts.push(`章節「${err.chapterTitle}」`);
  if (err.stepIndex !== undefined) {
    parts.push(`步驟 ${err.stepIndex + 1}${err.stepLabel ? `（${err.stepLabel}）` : ""}`);
  }
  const where = parts.length ? `${parts.join(" · ")}：` : "";
  return `${where}${err.error?.trim() || "未知錯誤"}`;
}

export function formatApiErrorMessage(
  res: Response,
  data: { error?: string; message?: string } | null,
  fallback: string,
): string {
  const raw = data?.error ?? data?.message;
  if (raw) return `HTTP ${res.status}：${raw}`;
  if (res.status === 502 || res.status === 504) {
    return `HTTP ${res.status}：伺服器逾時，請稍後重試`;
  }
  return fallback;
}

export function firstFailedCompactItem(
  items: Array<{ label: string; status: string; error?: string }>,
): string | null {
  const failed = items.find((i) => i.status === "failed" && i.error?.trim());
  return failed ? `${failed.label}：${failed.error}` : null;
}
