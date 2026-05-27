export type ColumnMeta = {
  key: string;
  format?: "text" | "number" | "percent" | "currency";
  unit?: string;
  miniBar?: boolean;
};

export type HighlightBest = {
  key: string;
  direction: "max" | "min";
};

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function inferColumnMeta(
  key: string,
  label: string,
  sampleValues: unknown[],
): ColumnMeta {
  const labelHint = `${key} ${label}`;
  const isPercent =
    /%|百分比|占比|比例/.test(labelHint) ||
    sampleValues.some((v) => typeof v === "string" && v.includes("%"));
  const isCurrency =
    /元|美元|USD|NT\$|TWD|萬|万|億|千|百/.test(labelHint) ||
    sampleValues.some((v) => typeof v === "string" && /[$¥€£]/.test(v));

  const numericCount = sampleValues.filter((v) => toNumber(v) !== null).length;
  const isNumericCol = numericCount >= Math.max(1, Math.ceil(sampleValues.length * 0.6));

  if (isPercent) return { key, format: "percent", unit: "%", miniBar: isNumericCol };
  if (isCurrency) return { key, format: "currency", unit: "元", miniBar: isNumericCol };
  if (isNumericCol) return { key, format: "number", miniBar: true };
  return { key, format: "text" };
}

export function formatCellValue(
  value: unknown,
  meta: ColumnMeta | undefined,
): string {
  if (value === null || value === undefined) return "";
  const n = toNumber(value);
  const format = meta?.format ?? (typeof value === "number" ? "number" : "text");

  if (format === "percent" && n !== null) {
    const p = n <= 1 && n >= 0 ? n * 100 : n;
    const digits = Math.abs(p) >= 10 ? 0 : Math.abs(p) >= 1 ? 1 : 2;
    return `${p.toFixed(digits)}%`;
  }

  if (format === "currency" && n !== null) {
    const unit = meta?.unit ?? "元";
    if (Math.abs(n) >= 10000) {
      const wan = n / 10000;
      const text = wan >= 10 ? wan.toFixed(1) : wan.toFixed(2);
      return `${text} 萬${unit}`;
    }
    return `${n.toLocaleString("zh-TW")}${meta?.unit ?? ""}`;
  }

  if (format === "number" && n !== null) {
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString("zh-TW", { maximumFractionDigits: 1 });
    if (Number.isInteger(n)) return n.toLocaleString("zh-TW");
    return n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
  }

  return String(value);
}

export function columnStats(
  rows: Record<string, string | number>[],
  columns: { key: string }[],
): Map<string, { min: number; max: number }> {
  const stats = new Map<string, { min: number; max: number }>();
  for (const col of columns) {
    if (col.key === "item") continue;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const n = toNumber(row[col.key]);
      if (n === null) continue;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    if (max > -Infinity) stats.set(col.key, { min, max });
  }
  return stats;
}

export function bestRowIndex(
  rows: Record<string, string | number>[],
  key: string,
  direction: "max" | "min",
): number {
  let bestIdx = 0;
  let bestVal = direction === "max" ? -Infinity : Infinity;
  rows.forEach((row, i) => {
    const n = toNumber(row[key]);
    if (n === null) return;
    if (direction === "max" ? n > bestVal : n < bestVal) {
      bestVal = n;
      bestIdx = i;
    }
  });
  return bestIdx;
}
