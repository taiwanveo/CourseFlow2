/**
 * DEBUG 9d8c4f — 僅伺服器端使用（含 node:fs）。
 * 禁止從 Client Component 匯入此檔。
 */
import "server-only";

import { appendFileSync } from "node:fs";
import { join } from "node:path";

export type WvpScreenTextAuditEntry = {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

const auditBuffer: WvpScreenTextAuditEntry[] = [];

function resolveDebugLogPaths(): string[] {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, "debug-9d8c4f.log"),
    join(cwd, "..", "debug-9d8c4f.log"),
    join(cwd, "..", "..", "debug-9d8c4f.log"),
  ];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const p of candidates) {
    const norm = join(p);
    if (seen.has(norm)) continue;
    seen.add(norm);
    paths.push(norm);
  }
  return paths;
}

function appendDebugLogLine(payload: string): void {
  for (const logPath of resolveDebugLogPaths()) {
    try {
      appendFileSync(logPath, `${payload}\n`);
    } catch {
      /* cwd 可能不可寫 */
    }
  }
}

export function clearWvpScreenTextAudit(): void {
  auditBuffer.length = 0;
}

export function getWvpScreenTextAudit(): readonly WvpScreenTextAuditEntry[] {
  return auditBuffer;
}

export function wvpDebugScreenAudit(entry: Omit<WvpScreenTextAuditEntry, "timestamp">): void {
  const row: WvpScreenTextAuditEntry = { ...entry, timestamp: Date.now() };
  auditBuffer.push(row);
  const payload = { sessionId: "9d8c4f", runId: "pack-audit", ...row };
  // #region agent log
  fetch("http://127.0.0.1:7452/ingest/6ce29d6e-c79a-4ab3-9dcd-48f49ba482e1", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d8c4f" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  appendDebugLogLine(JSON.stringify(payload));
  // #endregion
  console.log("[DEBUG-9d8c4f]", JSON.stringify(payload));
}
