import type { ExplainAnimationConfig } from "./schema.js";
import { ExplainAnimationConfigSchema } from "./schema.js";

const CN_DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9,
};

export function parseChineseInteger(raw: string): number | null {
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
    const bai = before ? (parseChineseInteger(before) ?? CN_DIGIT[before] ?? null) : 1;
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
    const shi = before ? (parseChineseInteger(before) ?? CN_DIGIT[before] ?? null) : 1;
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

function isDeltaPhrase(prefix: string): boolean {
  const p = prefix.trim();
  if (/第\s*[一二三四\d]+\s*[週周月季年]/.test(p)) return false;
  if (/成長到|成长到|增至|上升至|下降到/.test(p)) return false;
  return (
    /^(?:增幅|增長了|增长了|提升了|增加了|下降了|減少了|减少了|達到|达到)/.test(p) ||
    /增幅達|增幅为|增長達|增长达/.test(p)
  );
}

function splitListItems(t: string): string[] {
  return t
    .split(/[；;、\n]/)
    .map((s) => s.replace(/^第[一二三四五六七八九十\d]+[步点、.．]\s*/, "").trim())
    .filter((s) => s.length >= 2 && s.length <= 24)
    .slice(0, 6);
}

export type InferExplainResult = {
  config: ExplainAnimationConfig;
  confidence: "high" | "medium";
  reason: string;
};

/** 從口播／螢幕文字啟發式推斷解說動畫 DSL */
export function inferExplainAnimation(
  script: string,
  screen = "",
  visualHint = "",
): InferExplainResult | null {
  const t = `${screen} ${script} ${visualHint}`.trim();
  if (t.length < 4) return null;

  // 百分比成長／縮減（兩個時間點 + 可選增幅，排除增幅當第三點）
  const pctPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(/([^，,。；;]{0,12}?)百分之([一二三四五六七八九十百\d]+)/g)) {
    const prefix = (m[1] ?? "").replace(/為|为/g, "").trim();
    if (isDeltaPhrase(prefix)) continue;
    if (prefix && !/週|周|月|季|年|第/.test(prefix)) continue;
    const val = parseChineseInteger(m[2]!);
    if (val === null) continue;
    pctPairs.push({ label: prefix.slice(-4) || "項", value: val });
  }
  if (pctPairs.length >= 2) {
    const before = pctPairs[0]!.value;
    const after = pctPairs[pctPairs.length - 1]!.value;
    const deltaPct = Math.round(((after - before) / Math.max(1, before)) * 100);
    const pattern = after >= before ? "percent_grow" as const : "percent_shrink" as const;
    return wrap({
      version: 1,
      pattern,
      params: {
        beforeValue: before,
        afterValue: after,
        deltaPct: Math.abs(deltaPct),
        unit: "%",
        beforeLabel: pctPairs[0]!.label,
        afterLabel: pctPairs[pctPairs.length - 1]!.label,
      },
    }, "high", "中文百分比時間序列");
  }

  // 增加／減少 X 萬
  const addM = t.match(/(?:增加|加上|新增|多了)\s*([一二三四五六七八九十百\d]+|\d+)\s*萬/);
  const beforeAddM = t.match(/(?:原本|原有|原來)?\s*([A-Za-z\u4e00-\u9fff]{0,2})?\s*([一二三四五六七八九十百\d]+|\d+)\s*萬/);
  if (addM && beforeAddM) {
    const delta = parseChineseInteger(addM[1]!) ?? Number(addM[1]);
    const base = parseChineseInteger(beforeAddM[2]!) ?? Number(beforeAddM[2]);
    if (Number.isFinite(delta) && Number.isFinite(base)) {
      return wrap({
        version: 1,
        pattern: "amount_add",
        params: {
          beforeValue: base,
          delta,
          afterValue: base + delta,
          unit: "萬",
          entity: beforeAddM[1]?.trim() || "B",
          beforeLabel: "原本",
          afterLabel: "現在",
        },
      }, "high", "加法萬元");
    }
  }
  const subM = t.match(/(?:減少|減少|少了|扣除)\s*([一二三四五六七八九十百\d]+|\d+)\s*萬/);
  if (subM && beforeAddM) {
    const delta = parseChineseInteger(subM[1]!) ?? Number(subM[1]);
    const base = parseChineseInteger(beforeAddM[2]!) ?? Number(beforeAddM[2]);
    if (Number.isFinite(delta) && Number.isFinite(base)) {
      return wrap({
        version: 1,
        pattern: "amount_sub",
        params: {
          beforeValue: base,
          delta,
          afterValue: Math.max(0, base - delta),
          unit: "萬",
          entity: beforeAddM[1]?.trim() || "B",
          beforeLabel: "原本",
          afterLabel: "現在",
        },
      }, "high", "減法萬元");
    }
  }

  // 季度營收折線
  const seasonPairs: { label: string; value: number }[] = [];
  for (const m of t.matchAll(/第([一二三四1-4])季\s*([一二三四五六七八九十百\d]+|\d+)\s*萬?/g)) {
    const val = parseChineseInteger(m[2]!);
    if (val === null) continue;
    const map: Record<string, string> = { 一: "Q1", 二: "Q2", 三: "Q3", 四: "Q4", 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };
    seasonPairs.push({ label: map[m[1]!] ?? `Q${m[1]}`, value: val });
  }
  if (seasonPairs.length >= 2) {
    return wrap({
      version: 1,
      pattern: "sparkline_up",
      params: { points: seasonPairs, unit: "萬" },
    }, "high", "季度序列");
  }

  // 從 A 到 B
  const ab = t.match(/從\s*([A-Za-z\u4e00-\u9fff]{1,6})\s*(?:到|至|→)\s*([A-Za-z\u4e00-\u9fff]{1,6})/);
  if (ab) {
    return wrap({
      version: 1,
      pattern: "journey_a_to_b",
      params: { fromLabel: ab[1]!, toLabel: ab[2]! },
    }, "medium", "從 A 到 B");
  }

  // 平衡／兩端
  if (/平衡|翹翹板|兩端|權衡/.test(t)) {
    const left = t.match(/(品質[^⇆↔—\-到至]{0,12}|深度[^⇆]{0,8})/)?.[0]?.slice(0, 10) ?? "左端";
    const right = t.match(/(速度[^，,。]{0,12}|效率[^，,。]{0,8})/)?.[0]?.slice(0, 10) ?? "右端";
    return wrap({
      version: 1,
      pattern: "balance_seesaw",
      params: {
        leftLabel: left,
        rightLabel: right,
        sequence: ["left", "right", "balance"],
      },
    }, "medium", "平衡隱喻");
  }

  // 對比
  if (/對比|对比|一方面|另一方面|VS|vs/.test(t)) {
    const parts = t.split(/對比|对比|VS|vs/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return wrap({
        version: 1,
        pattern: "split_contrast",
        params: {
          leftTitle: parts[0]!.slice(0, 10),
          rightTitle: parts[1]!.slice(0, 10),
          leftPoints: [],
          rightPoints: [],
        },
      }, "medium", "左右對比");
    }
  }

  // KPI 單一數字
  const kpiM = t.match(/(\d+(?:\.\d+)?)\s*(%|％)/);
  if (kpiM && t.length < 60 && /率|比|達|到/.test(t)) {
    return wrap({
      version: 1,
      pattern: "counter_kpi",
      params: {
        target: Number(kpiM[1]),
        unit: "%",
        label: screen.slice(0, 10) || "KPI",
      },
    }, "medium", "單一 KPI");
  }

  // 倍數
  const mulM = t.match(/([二三兩三四]|[2-9])\s*倍|翻(?:了)?([二三兩三四]|[2-9])倍/);
  if (mulM) {
    const factor = parseChineseInteger(mulM[1] ?? mulM[2] ?? "2") ?? 2;
    return wrap({
      version: 1,
      pattern: "multiplier",
      params: { base: 1, factor, unit: "倍" },
    }, "medium", "倍數成長");
  }

  // 流程步驟
  const stepItems = [...t.matchAll(/第[一二三四五六七八九十\d]+步[^，,。；;]{0,16}/g)].map((m) =>
    m[0]!.replace(/^第[一二三四五六七八九十\d]+步/, "").trim() || m[0]!.slice(0, 8),
  );
  if (stepItems.length >= 2) {
    return wrap({
      version: 1,
      pattern: "process_flow",
      params: { steps: stepItems.slice(0, 5) },
    }, "medium", "多步流程");
  }

  // 清單條列
  const listItems = splitListItems(t);
  if (listItems.length >= 3 && !/\d+\s*萬|百分之/.test(t)) {
    if (/優先|排序|首要/.test(t)) {
      return wrap({
        version: 1,
        pattern: "priority_rank",
        params: {
          items: listItems.map((label, i) => ({ label: label.slice(0, 12), rank: i + 1 })),
        },
      }, "medium", "優先排序");
    }
    if (/完成|勾選|檢核/.test(t)) {
      return wrap({
        version: 1,
        pattern: "checklist_ticks",
        params: { items: listItems },
      }, "medium", "清單勾選");
    }
    return wrap({
      version: 1,
      pattern: "stagger_reveal",
      params: { items: listItems },
    }, "medium", "條列揭示");
  }

  // 漏斗
  if (/漏斗|篩選|轉換率/.test(t) && listItems.length >= 2) {
    return wrap({
      version: 1,
      pattern: "funnel_narrow",
      params: { stages: listItems },
    }, "medium", "漏斗");
  }

  // 文氏圖交集（優先於年份軸，避免長句誤判）
  const vennM = t.match(
    /([\u4e00-\u9fffA-Za-z]{1,8})\s*與\s*([\u4e00-\u9fffA-Za-z]{1,8})\s*(?:的)?\s*(?:交集|重疊|共同)/,
  );
  if (vennM || /交集|文氏|venn|重疊區/.test(t)) {
    return wrap({
      version: 1,
      pattern: "venn_overlap",
      params: {
        leftLabel: vennM?.[1]?.slice(0, 6) || "A",
        rightLabel: vennM?.[2]?.slice(0, 6) || "B",
        overlapLabel: /共同|交集/.test(t) ? "交集" : undefined,
      },
    }, "medium", "集合交集");
  }

  // 前後對照滑桿
  if (/改造之前|改造之後|改造前|改造後|前後對照|before|after/i.test(t)) {
    const beforeM = t.match(/(?:改造之前|改造前|之前|以前)[，,。\s]*(?:相當|十分|非常)?([^，,。]{0,8})?/);
    const afterM = t.match(/(?:改造之後|改造後|之後|以後)[，,。\s]*(?:變得|變成|十分|非常)?([^，,。]{1,8})?/);
    return wrap({
      version: 1,
      pattern: "before_after_slider",
      params: {
        beforeLabel: beforeM?.[1]?.slice(0, 6) || "改造前",
        afterLabel: afterM?.[1]?.slice(0, 6) || "改造後",
        sliderPosition: 0.5,
      },
    }, "medium", "前後滑桿");
  }

  // 等式平衡
  const eqM = t.match(/([^\s=＝]{1,10})\s*[=＝]\s*([^\s，,。]{1,10})/);
  const eqCn = t.match(/([^\s，,。]{1,8})\s*等於\s*([^\s，,。]{1,16})/);
  if (eqM || eqCn || /方程式|等式|左右兩邊|兩邊相等/.test(t)) {
    const left = eqCn?.[1] ?? eqM?.[1] ?? "收入";
    const right = eqCn?.[2] ?? eqM?.[2] ?? "成本+利潤";
    return wrap({
      version: 1,
      pattern: "equation_balance",
      params: {
        leftExpr: left.slice(0, 12),
        rightExpr: right.slice(0, 12),
        balanced: true,
      },
    }, "medium", "等式平衡");
  }

  // 年份軸（無數值趨勢時的備援動畫）
  const yearHits: { year: number; label?: string }[] = [];
  for (const m of t.matchAll(/(20\d{2}|19\d{2})年/g)) {
    const year = Number.parseInt(m[1]!, 10);
    if (!yearHits.some((y) => y.year === year)) {
      yearHits.push({ year });
    }
  }
  if (yearHits.length >= 2 && !/越低|下降|減少|下滑|遞減|递减|降低/.test(t)) {
    yearHits.sort((a, b) => a.year - b.year);
    return wrap({
      version: 1,
      pattern: "timeline_year",
      params: { years: yearHits.slice(0, 8) },
    }, "high", "年份序列");
  }

  // 橋接／連接
  if (/橋接|連接|串連|打通/.test(t)) {
    return wrap({
      version: 1,
      pattern: "bridge_link",
      params: { leftLabel: "起點", rightLabel: "終點" },
    }, "medium", "橋接");
  }

  // 螢幕短語強調（Beat-Scene 重點步等）
  const short = screen.trim().replace(/\s*[｜|].*$/, "").slice(0, 16);
  if (short.length >= 2 && short.length <= 16) {
    return wrap({
      version: 1,
      pattern: "pulse_highlight",
      params: { text: short },
    }, "medium", "螢幕關鍵詞強調");
  }

  return null;
}

function wrap(
  raw: ExplainAnimationConfig,
  confidence: "high" | "medium",
  reason: string,
): InferExplainResult | null {
  const parsed = ExplainAnimationConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { config: parsed.data, confidence, reason };
}
