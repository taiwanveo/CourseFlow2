export type WvpDebugTraceEntry = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

let traceBuffer: WvpDebugTraceEntry[] = [];

export function resetWvpDebugTrace(): void {
  traceBuffer = [];
}

export function wvpDebugTrace(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
): void {
  const entry: WvpDebugTraceEntry = {
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  traceBuffer.push(entry);
  console.info("[DEBUG-c64e28]", JSON.stringify(entry));
  // #region agent log
  fetch("http://127.0.0.1:7452/ingest/6ce29d6e-c79a-4ab3-9dcd-48f49ba482e1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c64e28",
    },
    body: JSON.stringify({
      sessionId: "c64e28",
      runId: "trial",
      ...entry,
    }),
  }).catch(() => {});
  // #endregion
}

export function getWvpDebugTrace(): WvpDebugTraceEntry[] {
  return [...traceBuffer];
}
