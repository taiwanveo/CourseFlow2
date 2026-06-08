/** 結構化日誌（Zeabur / Worker 可搜尋 jobRunId、projectId、pipeline） */

export type StructuredLogFields = {
  pipeline?: string;
  jobRunId?: string;
  projectId?: string;
  wvpChapterId?: string;
  step?: number;
  phase?: string;
  message: string;
  error?: string;
};

export function logStructured(level: "info" | "warn" | "error", fields: StructuredLogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
