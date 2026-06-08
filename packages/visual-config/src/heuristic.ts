import type { VisualConfig } from "./schema/visual.js";

const PAIR_RE =
  /([^，,；;\n]+?)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(%|億|萬|万|千|百|人|元|美元|USD|倍)?/g;

function slugLabel(s: string): string {
  const t = s
    .trim()
    .replace(/^[「『"'\s]+/, "")
    .replace(/[」』"'\s]+$/, "");
  if (!t || /^[從到年至而之]$/.test(t) || /^年到?$/.test(t) || /^從/.test(t)) {
    return "";
  }
  return t.slice(0, 12) || "項目";
}

function percentSeriesLabel(prefix: string, contextText = ""): string {
  const p = prefix
    .replace(/為|为|達到|达到/g, "")
    .replace(/成長到|成长到|增至|上升至|下降到/g, "")
    .trim();
  const week = p.match(/第([一二三四\d]+)[週周]/);
  if (week) {
    if (/完成率/.test(p) || /完成率/.test(contextText)) {
      return `第${week[1]}週完成率`;
    }
    return `第${week[1]}週`;
  }
  const season = p.match(/第([一二三四\d]+)季/);
  if (season) return `第${season[1]}季`;
  const labeled = slugLabel(p);
  return labeled || "項目";
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

function shortDataTitle(text: string, fallback: string): string {
  if (/完成率/.test(text)) return "完成率趨勢";
  if (/營收|营收|季度|季營/.test(text)) return "季度營收";
  if (/方案/.test(text)) return "方案對比";
  const trimmed = text.trim();
  if (trimmed.length <= 16) return trimmed;
  return fallback;
}

/** KPI／圖表標題：禁止口播步驟說明外洩 */
function shortKpiTitle(text: string): string {
  let t = text.trim();
  const leakAt = t.search(
    /第[一二三四五1-5]步|假[設设]|看完成率|資料顯示|假设资料|假設資料|口播/,
  );
  if (leakAt > 0) t = t.slice(0, leakAt).trim();
  const first = t.split(/[。！？.!?；;]/)[0]?.trim() ?? t;
  if (/學員完成率|完成率/.test(first)) return "學員完成率";
  if (/營收|营收/.test(first)) return "季度營收";
  return first.slice(0, 12) || "關鍵指標";
}

/** 純增量描述略過；「第 N 週成長到」等時間端點保留 */
function isPercentDeltaPhrase(prefix: string): boolean {
  const p = prefix.trim();
  if (/第\s*[一二三四\d]+\s*[週周月季年]/.test(p)) return false;
  if (/成長到|成长到|增至|上升至|下降到/.test(p)) return false;
  return (
    /^(?:增幅|增長了|增长了|提升了|增加了|下降了|減少了|减少了|達到|达到)/.test(p) ||
    /增幅達|增幅为|增長達|增长达/.test(p)
  );
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
  const hasPercent = unit === "%" || /%/.test(title);
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
/** 分號分隔的多方案敘述 → 表格（例：人工製作…；AI 自動化…；CourseFlow 折衷…） */
function inferSemicolonComparisonTable(text: string): VisualConfig | null {
  if (!/[；;]/.test(text)) return null;
  if (
    !/方案對比|方案对比|方案比較|三種方案|表格視覺|對比|对比|比較|比较|對照/.test(text)
  ) {
    return null;
  }

  const segments = text
    .split(/[；;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .slice(0, 8);
  if (segments.length < 2) return null;

  let first = segments[0]!;
  first = first
    .replace(/^[^。！？.!?]*方案對比[。.！？]?\s*/i, "")
    .replace(/^使用表格視覺進行\s*/i, "")
    .replace(/^第[一二三四\d]+步[^。！？.!?]*[。.！？]?\s*/i, "")
    .trim();

  const rows: Record<string, string>[] = [];
  for (const raw of [first, ...segments.slice(1)]) {
    const seg = raw.replace(/[。.！？!?]+$/, "").trim();
    if (seg.length < 4) continue;

    const abc = seg.match(/^方案\s*([ABCＡＢＣ])\s*(.+)$/i);
    if (abc) {
      rows.push({
        item: `方案 ${abc[1]!.toUpperCase()}`,
        說明: abc[2]!.trim().slice(0, 64),
      });
      continue;
    }

    const comma = seg.match(/^(.{3,32}?)[，,](.+)$/);
    if (comma) {
      const name = comma[1]!
        .replace(/^使用/, "")
        .replace(/^採用/, "")
        .trim();
      rows.push({
        item: name.slice(0, 28),
        說明: comma[2]!.trim().slice(0, 64),
      });
    }
  }

  const validRows = rows.filter((r) => r.item.length > 0 && r.說明.length > 0);
  if (validRows.length < 2) return null;

  return {
    kind: "table",
    title: shortDataTitle(text, "方案對比"),
    columns: [
      { key: "item", label: "方案" },
      { key: "說明", label: "特點" },
    ],
    rows: validRows,
    reveal: "row",
    emphasis: "row",
  } as unknown as VisualConfig;
}

function inferNumericComparisonTable(text: string): VisualConfig | null {
  const t = text.trim();
  if (!/(?:對照|比較|比较|方案|選項|选项)/.test(t) || !/[；;\n]/.test(t) || !/[:：]/.test(t)) {
    return null;
  }

  const trimmed = t.replace(/^(?:方案對照|對照|比較|比较)\s*[：:]\s*/g, "");
  const segments = trimmed
    .split(/[；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .slice(0, 8);

  const rows: Record<string, string | number>[] = [];
  const colKeys = new Set<string>();

  for (const seg of segments) {
    const normalized = seg.replace(/^方案\s*[：:]\s*/gi, "");
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

  if (rows.length < 2 || colKeys.size < 1) return null;

  const keys = [...colKeys].slice(0, 5);
  const columns = [
    { key: "item", label: "項目" },
    ...keys.map((k) => ({ key: k, label: k.replace(/_/g, " ") })),
  ];
  const preferred =
    keys.find((k) => /(成本|價格|延遲|延迟|耗時|用時)/.test(k)) ?? keys[0];
  const columnMeta = keys.map((k) => {
    const label = k.replace(/_/g, " ");
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

export function inferVisualConfigFromText(text: string): VisualConfig | null {
  const t = text.trim();
  if (t.length < 6) return null;

  // 中文季度營收：第一季一百萬、第二季一百二十萬…
  const seasonPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(
    /第([一二三四1-4])季\s*([一二三四五六七八九十百\d]+|\d+)\s*萬?/g,
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
    return chartFromPairs(seasonPairs, shortDataTitle(t, "季度營收"), "萬", true);
  }

  // 中文百分比：第一週百分之六十五、第四週百分之八十五（排除「增幅達百分之二十」等增量描述）
  const cnPercentPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(
    /([^，,。；;]{0,12}?)百分之([一二三四五六七八九十百\d]+)/g,
  )) {
    const val = parseChineseInteger(m[2]!);
    if (val === null) continue;
    const prefix = (m[1] ?? "").replace(/為|为|達到|达到/g, "").trim();
    if (isPercentDeltaPhrase(prefix)) continue;
    if (prefix && !/週|周|月|季|年|第|完成率|率/.test(prefix)) continue;
    const label = percentSeriesLabel(prefix, t);
    if (!label) continue;
    cnPercentPairs.push({ label, value: val });
  }
  if (cnPercentPairs.length >= 2) {
    return chartFromPairs(cnPercentPairs, shortDataTitle(t, "完成率趨勢"), "%", true);
  }

  // 年份區間 + 遞減趨勢（例：從 2018 年到 2023 年，出生率就越來越低）
  const yearDecline = t.match(
    /(20\d{2}).{0,24}?(20\d{2}).{0,32}?(越低|下降|減少|减少|下滑|遞減|递减|降低|萎縮|萎缩)/,
  );
  if (yearDecline) {
    const y1 = Number.parseInt(yearDecline[1]!, 10);
    const y2 = Number.parseInt(yearDecline[2]!, 10);
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const years: number[] = [];
    for (let y = lo; y <= hi; y++) years.push(y);
    if (years.length >= 2) {
      const startVal = 100;
      const endVal = 35;
      const pairs = years.map((y, i) => ({
        label: String(y),
        value: Math.round(
          startVal - (i * (startVal - endVal)) / Math.max(1, years.length - 1),
        ),
      }));
      const declineTitle = /出生/.test(t)
        ? "出生率趨勢"
        : shortDataTitle(t, "趨勢變化");
      return chartFromPairs(pairs, declineTitle, "%", true);
    }
  }

  // 數字方案對照表（優先於分號定性方案表）
  const numericComparisonTable = inferNumericComparisonTable(t);
  if (numericComparisonTable) return numericComparisonTable;

  const semicolonComparison = inferSemicolonComparisonTable(t);
  if (semicolonComparison) return semicolonComparison;

  // 定性方案對比：方案 A 成本較低…方案 B…（無數字欄位時）
  if (/方案\s*[ABCＡＢＣ]/i.test(t) || /三種方案/.test(t)) {
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
        title: shortDataTitle(t, "方案對比"),
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

  const pairs: { label: string; value: number; unit?: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PAIR_RE.source, PAIR_RE.flags);
  while ((m = re.exec(t)) !== null) {
    const label = slugLabel(m[1]!);
    if (!label) continue;
    const value = parseFloat(m[2]!);
    if (!Number.isFinite(value)) continue;
    // 年份數字不當一般數值對（避免「從 2018 年到 2023」誤判）
    if (/^20\d{2}$/.test(String(Math.round(value))) && /年|從|到/.test(m[1]! + t)) {
      continue;
    }
    pairs.push({ label, value, unit: m[3] });
  }

  if (pairs.length >= 2) {
    const allPercent = pairs.every((p) => p.unit === "%");
    const unit = allPercent ? "%" : pairs[0]?.unit;
    const forceLine =
      !allPercent &&
      (pairs.length >= 4 || /曲線|曲线|趨勢|趋势/.test(t));
    return chartFromPairs(
      pairs.map((p) => ({ label: p.label, value: p.value })),
      t.slice(0, 32),
      unit,
      forceLine,
    );
  }

  const kpi = t.match(/(\d+(?:\.\d+)?)\s*(%|億|萬|万|倍)?/);
  const metricHint = /(?:率|比|達到|达到|為|为)\s*\d/.test(t);
  const multiPctInScript = (t.match(/百分之/g) ?? []).length >= 2;
  if (
    !multiPctInScript &&
    ((kpi && t.length < 80) || (metricHint && kpi))
  ) {
    return {
      kind: "chart",
      chartType: "kpi",
      title: shortKpiTitle(t.replace(kpi[0], "").trim() || t),
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
  if (
    listItems.length >= 2 &&
    listItems.length <= 8 &&
    !/\d{2,}/.test(t) &&
    !/第[一二三四1-4]季|季度|營收|营收|折線|折线|成長曲線|成长曲线/.test(t) &&
    !/方案對比|方案对比|表格視覺|三種方案|方案\s*[ABCＡＢＣ]/i.test(t)
  ) {
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
