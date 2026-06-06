import type { VisualConfig } from "./schema/visual.js";

const PAIR_RE =
  /([^，,；;\n]+?)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(%|億|萬|万|千|百|人|元|美元|USD|倍)?/g;

function slugLabel(s: string): string {
  return s.trim().slice(0, 12) || "項目";
}

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 解析簡體中文數字（0–9999），例：六十五→65、一百二十→120 */
function parseChineseInteger(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  if (s === "十") return 10;
  if (s.startsWith("十")) {
    const rest = s.slice(1);
    return 10 + (rest ? (parseChineseInteger(rest) ?? CN_DIGIT[rest] ?? 0) : 0);
  }
  let total = 0;
  if (s.includes("百")) {
    const [before, after] = s.split("百");
    const bai = before
      ? (parseChineseInteger(before) ?? CN_DIGIT[before] ?? null)
      : 1;
    if (bai === null) return null;
    total += bai * 100;
    if (after) {
      const tail = parseChineseInteger(after);
      if (tail === null) return null;
      total += tail;
    }
    return total;
  }
  if (s.includes("十")) {
    const [before, after] = s.split("十");
    const shi = before
      ? (parseChineseInteger(before) ?? CN_DIGIT[before] ?? null)
      : 1;
    if (shi === null) return null;
    total += shi * 10;
    if (after) {
      const tail = CN_DIGIT[after] ?? parseChineseInteger(after);
      if (tail === null) return null;
      total += tail;
    }
    return total;
  }
  return CN_DIGIT[s] ?? null;
}

function chartFromPairs(
  pairs: { label: string; value: number }[],
  title: string,
  unit?: string,
  forceLine?: boolean,
): VisualConfig {
  const xKey = "label";
  const yKey = "value";
  const data = pairs.map((p) => ({ [xKey]: p.label, [yKey]: p.value }));
  const hasPercent = unit === "%" || pairs.every((p) => title.includes("%"));
  if (hasPercent && pairs.length <= 6 && !forceLine) {
    return {
      kind: "chart",
      chartType: "pie",
      title: title.slice(0, 32),
      xKey,
      yKey,
      data,
      unit: "%",
      colorRole: "categorical",
    };
  }
  return {
    kind: "chart",
    chartType: forceLine || pairs.length >= 4 ? "line" : "bar",
    title: title.slice(0, 32),
    xKey,
    yKey,
    data,
    unit,
    colorRole: "categorical",
  };
}

/** 從口播／畫面文字啟發式產出 VisualConfig（無 LLM） */
export function inferVisualConfigFromText(text: string): VisualConfig | null {
  const t = text.trim();
  if (t.length < 6) return null;

  // 中文季度營收：第一季一百萬、第二季一百二十萬…
  const seasonPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(
    /第([一二三四1-4])季\s*([一二三四五六七八九十百\d]+)\s*萬?/g,
  )) {
    const val = parseChineseInteger(m[2]!);
    if (val === null) continue;
    const seasonMap: Record<string, string> = {
      一: "Q1",
      二: "Q2",
      三: "Q3",
      四: "Q4",
      1: "Q1",
      2: "Q2",
      3: "Q3",
      4: "Q4",
    };
    seasonPairs.push({
      label: seasonMap[m[1]!] ?? `Q${m[1]}`,
      value: val,
    });
  }
  if (seasonPairs.length >= 2) {
    return chartFromPairs(seasonPairs, t.slice(0, 32), "萬", true);
  }

  // 中文百分比：第一週百分之六十五、第四週百分之八十五
  const cnPercentPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(
    /([^，,。；;]{0,12}?)百分之([一二三四五六七八九十百\d]+)/g,
  )) {
    const val = parseChineseInteger(m[2]!);
    if (val === null) continue;
    const label = slugLabel((m[1] ?? "").replace(/為|为|達到|达到/g, ""));
    cnPercentPairs.push({ label, value: val });
  }
  if (cnPercentPairs.length >= 2) {
    return chartFromPairs(cnPercentPairs, t.slice(0, 32), "%", true);
  }

  // 定性方案對比：方案 A 成本較低…方案 B…（無數字欄位時）
  if (/方案\s*[ABCＡＢＣ]/i.test(t) && /對比|对比|對照|比较|三種方案/.test(t)) {
    const rows: Record<string, string>[] = [];
    for (const m of t.matchAll(
      /方案\s*([ABCＡＢＣ])\s*([^，,。；;]*?)(?=(?:，|,|。|;|；|方案\s*[ABCＡＢＣ]|$))/gi,
    )) {
      const desc = m[2]!.trim().replace(/^[：:\s]+/, "");
      if (!desc) continue;
      rows.push({
        item: `方案 ${m[1]!.toUpperCase()}`,
        說明: desc.slice(0, 48),
      });
    }
    if (rows.length >= 2) {
      return {
        kind: "table",
        title: "方案對比",
        columns: [
          { key: "item", label: "方案" },
          { key: "說明", label: "特點" },
        ],
        rows,
        reveal: "row",
        emphasis: "row",
      } as unknown as VisualConfig;
    }
  }

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
    const unit = pairs.every((p) => p.unit === "%") ? "%" : pairs[0]?.unit;
    return chartFromPairs(
      pairs.map((p) => ({ label: p.label, value: p.value })),
      t.slice(0, 32),
      unit,
      pairs.length >= 4 || /曲線|曲线|趨勢|趋势/.test(t),
    );
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
