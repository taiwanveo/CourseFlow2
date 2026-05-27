import type { VisualConfig } from "./schema/visual.js";

const PAIR_RE =
  /([^，,；;\n]+?)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(%|億|萬|万|千|百|人|元|美元|USD|倍)?/g;

function slugLabel(s: string): string {
  return s.trim().slice(0, 12) || "項目";
}

/** 從口播／畫面文字啟發式產出 VisualConfig（無 LLM） */
export function inferVisualConfigFromText(text: string): VisualConfig | null {
  const t = text.trim();
  if (t.length < 6) return null;

  // Table heuristic（簡單版）：偵測「欄:值、欄:值」的多欄多列情境
  // 例：「方案A：成本 12K、速度 80、品質 92；方案B：成本 9K、速度 70、品質 88」
  if (/(?:對照|比較|比较|方案|選項|选项)/.test(t) && /[；;\n]/.test(t) && /[:：]/.test(t)) {
    // 先去掉「方案對照：」「對照：」這類前綴；但保留「方案：A：...」的第二層冒號做 rowName
    const trimmed = t.replace(/^(?:方案對照|對照|比較|比较)\s*[：:]\s*/g, "");

    const segments = trimmed
      .split(/[；;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 6)
      .slice(0, 8);

    const rows: Record<string, string | number>[] = [];
    const colKeys = new Set<string>();

    for (const seg of segments) {
      // 允許「方案：A：...」這種雙冒號：把 rowName 取最後一段（A/B/C）
      const normalized = seg.replace(/^方案\s*[：:]\s*/g, "");
      // rowName：第一個冒號之前；rest：後面是「欄 值、欄 值」
      const firstColon = normalized.search(/[：:]/);
      if (firstColon <= 0) continue;
      const rowName = normalized.slice(0, firstColon).trim();
      const rest = normalized.slice(firstColon + 1).trim();
      if (!rowName || !rest) continue;

      const row: Record<string, string | number> = { item: rowName };
      const cells = rest
        .split(/[，,、]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8);

      for (const cell of cells) {
        const m = cell.match(
          /^(.+?)\s*(\d+(?:\.\d+)?)\s*(%|億|萬|万|千|百|人|元|美元|USD|倍|K|k)?$/,
        );
        if (!m) continue;
        const key = m[1]!.trim().replace(/\s+/g, "_").slice(0, 18);
        const val = parseFloat(m[2]!);
        row[key] = Number.isFinite(val) ? val : m[2]!;
        colKeys.add(key);
      }

      rows.push(row);
    }

    if (rows.length >= 2 && colKeys.size >= 1) {
      const keys = [...colKeys].slice(0, 5);
      const columns = [
        { key: "item", label: "項目" },
        ...keys.map((k) => ({ key: k, label: k.replace(/_/g, " ") })),
      ];

      // sortBy：優先找「成本/價格/延遲」等常見比較欄
      const preferred =
        keys.find((k) => /(成本|價格|延遲|延迟|耗時|用時)/.test(k)) ??
        keys[0];

      const columnMeta = keys.map((k) => {
        const label = k.replace(/_/g, " ");
        const samples = rows.map((r) => r[k]);
        const isPercent = /率|占比|比例/.test(`${k} ${label}`);
        const isCurrency = /成本|價格|价格|元|万|萬/.test(`${k} ${label}`);
        const format = isPercent
          ? ("percent" as const)
          : isCurrency
            ? ("currency" as const)
            : ("number" as const);
        return {
          key: k,
          format,
          unit: isPercent ? "%" : isCurrency ? "元" : undefined,
          miniBar: true,
        };
      });

      const scoreKey = keys.find((k) => /(品質|质量|準確|准确|分數|分数|穩定|稳定)/.test(k));
      const highlightBest = scoreKey
        ? { key: scoreKey, direction: "max" as const }
        : preferred
          ? {
              key: preferred,
              direction: /(成本|價格|价格|延遲|延迟|耗時|用時)/.test(preferred)
                ? ("min" as const)
                : ("max" as const),
            }
          : undefined;

      return {
        kind: "table",
        title: t.slice(0, 18),
        columns,
        rows,
        sortBy: preferred ? { key: preferred, direction: "asc" } : undefined,
        highlightColumn: preferred,
        emphasis: "column",
        numericAlign: "right",
        reveal: "row",
        columnMeta,
        highlightBest,
      } as unknown as VisualConfig;
    }
  }

  const pairs: { label: string; value: number; unit?: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PAIR_RE.source, PAIR_RE.flags);
  while ((m = re.exec(t)) !== null) {
    const label = slugLabel(m[1]!);
    const value = parseFloat(m[2]!);
    if (!Number.isFinite(value)) continue;
    pairs.push({ label, value, unit: m[3] });
  }

  if (pairs.length >= 2) {
    const hasPercent = pairs.every((p) => p.unit === "%" || t.includes("%"));
    const xKey = "label";
    const yKey = "value";
    const data = pairs.map((p) => ({ [xKey]: p.label, [yKey]: p.value }));
    if (hasPercent && pairs.length <= 6) {
      return {
        kind: "chart",
        chartType: "pie",
        title: t.slice(0, 32),
        xKey,
        yKey,
        data,
        unit: "%",
        colorRole: "categorical",
      };
    }
    return {
      kind: "chart",
      chartType: pairs.length >= 4 ? "line" : "bar",
      title: t.slice(0, 32),
      xKey,
      yKey,
      data,
      unit: pairs[0]?.unit,
      colorRole: "categorical",
    };
  }

  const kpi = t.match(/(\d+(?:\.\d+)?)\s*(%|億|萬|万|倍)?/);
  const metricHint = /(?:率|比|達到|达到|為|为)\s*\d/.test(t);
  if ((kpi && t.length < 80) || (metricHint && kpi)) {
    return {
      kind: "chart",
      chartType: "kpi",
      title: t.replace(kpi[0], "").trim().slice(0, 24) || "關鍵指標",
      xKey: "label",
      yKey: "value",
      data: [{ label: "value", value: parseFloat(kpi[1]!) }],
      unit: kpi[2],
      colorRole: "highlight",
    };
  }

  const listItems = t
    .split(/[；;]\s*|\n+/)
    .map((s) => s.replace(/^第[一二三四五六七八九十\d]+[、.．]\s*/, "").trim())
    .filter((s) => s.length >= 4 && s.length <= 80);
  if (listItems.length >= 2 && listItems.length <= 8 && !/\d{2,}/.test(t)) {
    return {
      kind: "animation",
      title: listItems[0]!.slice(0, 20),
      pattern: "reveal-list",
      items: listItems.map((text, i) => ({
        text,
        emphasis: i === listItems.length - 1,
      })),
    };
  }

  return null;
}

export const FALLBACK_CALLOUT: VisualConfig = {
  kind: "animation",
  title: "重點",
  pattern: "callout",
  items: [{ text: "請留意本步核心概念", emphasis: true }],
};
