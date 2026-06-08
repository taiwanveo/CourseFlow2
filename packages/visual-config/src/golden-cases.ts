import { safeParseVisualConfig } from "./schema/visual.js";
import { inferVisualConfigFromText } from "./heuristic.js";

export interface GoldenCase {
  id: string;
  input: string;
  expectKind: "chart" | "table" | "animation";
  expectChartType?: string;
  expectTableSortKey?: string;
}

/** B4：啟發式回歸案例（可擴充至 20+） */
export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "pie-share",
    input: "市佔率：台灣 45%、日本 30%、韓國 25%",
    expectKind: "chart",
    expectChartType: "pie",
  },
  {
    id: "bar-compare",
    input: "營收：Q1 120、Q2 135、Q3 150",
    expectKind: "chart",
  },
  {
    id: "line-trend",
    input: "1月100、2月150、3月210、4月280、5月340、6月420",
    expectKind: "chart",
  },
  {
    id: "kpi-single",
    input: "轉換率達到 38%",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "kpi-conversion-craft-meta",
    input:
      "單一指標：轉換率 KPI\n4-3 單一指標 KPI。轉換率達到3\n轉換率達到38%。預期產出為 KPI 大數字卡片",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "list-reveal",
    input: "三點：先清洗資料；再訓練模型；最後驗證結果",
    expectKind: "animation",
  },
  {
    id: "expense-split",
    input: "部門費用：研發 40%、行銷 25%、營運 20%、管理 15%",
    expectKind: "chart",
    expectChartType: "pie",
  },
  {
    id: "expense-pie-craft-meta",
    input:
      "費用結構：部門圓餅圖\n4-2 費用結構圓餅圖。部門費用分別為研發\n部門費用分別為研發40%、行銷25%、營運20%、管理15%。預期產出圓餅圖，四項加總100%。",
    expectKind: "chart",
    expectChartType: "pie",
  },
  {
    id: "quarter-bar",
    input: "2024 年四季營收 Q1 120億 Q2 135億 Q3 150億 Q4 180億",
    expectKind: "chart",
  },
  {
    id: "month-line",
    input: "每月新用戶 1月100 2月150 3月210 4月280",
    expectKind: "chart",
  },
  {
    id: "growth-kpi",
    input: "年成長率 127%",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "compare-bar",
    input: "A 產品 320、B 產品 280、C 產品 190",
    expectKind: "chart",
    expectChartType: "bar",
  },
  {
    id: "ratio-pie",
    input: "占比：桌面 55%、行動 35%、平板 10%",
    expectKind: "chart",
    expectChartType: "pie",
  },
  {
    id: "steps-anim",
    input: "流程：收集需求；設計方案；開發上線",
    expectKind: "animation",
  },
  {
    id: "bullet-anim",
    input: "第一、建立信任；第二、提供價值；第三、持續優化",
    expectKind: "animation",
  },
  {
    id: "short-kpi",
    input: "留存率 62%",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "multi-bar",
    input: "得分：甲 88、乙 76、丙 91、丁 83",
    expectKind: "chart",
  },
  {
    id: "trend-line",
    input: "週活躍 1000 1200 1500 1800 2200",
    expectKind: "chart",
  },
  {
    id: "list-semicolon",
    input: "要點；先對齊目標；再拆解任務；最後驗收",
    expectKind: "animation",
  },
  {
    id: "market-pie",
    input: "三個市場市佔：台灣 45、日本 30、韓國 25",
    expectKind: "chart",
  },
  {
    id: "single-metric",
    input: "NPS 達到 72 分",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "sales-bar",
    input: "銷量：A 1200、B 980、C 760",
    expectKind: "chart",
    expectChartType: "bar",
  },
  {
    id: "time-series",
    input: "趨勢：2021 10、2022 14、2023 18、2024 23",
    expectKind: "chart",
  },
  {
    id: "percent-kpi",
    input: "完成率為 96%",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "compare-pie",
    input: "比例：男性 52%、女性 48%",
    expectKind: "chart",
    expectChartType: "pie",
  },
  {
    id: "list-steps",
    input: "三步驟：定義問題；蒐集資料；產出結論",
    expectKind: "animation",
  },
  {
    id: "list-lines",
    input: "重點：\n- 避免過擬合\n- 做交叉驗證\n- 監控漂移",
    expectKind: "animation",
  },
  {
    id: "money-bar",
    input: "成本：伺服器 32000、帶寬 12000、儲存 8000",
    expectKind: "chart",
    expectChartType: "bar",
  },
  {
    id: "users-trend",
    input: "每日活躍：週一 120、週二 140、週三 180、週四 210",
    expectKind: "chart",
  },
  {
    id: "kpi-growth",
    input: "本月成長 18%",
    expectKind: "chart",
    expectChartType: "kpi",
  },
  {
    id: "score-rank",
    input: "排名：甲 95、乙 90、丙 88、丁 82",
    expectKind: "chart",
  },
  {
    id: "share-pie-no-symbol",
    input: "占比：甲 45、乙 35、丙 20",
    expectKind: "chart",
  },
  {
    id: "table-compare-options",
    input: "方案對照：方案A：成本 12、速度 80、品質 92；方案B：成本 9、速度 70、品質 88；方案C：成本 14、速度 92、品質 90",
    expectKind: "table",
    expectTableSortKey: "成本",
  },
  {
    id: "table-compare-zh",
    input: "比較：模型A：準確率 0.91、延遲 120；模型B：準確率 0.89、延遲 80",
    expectKind: "table",
  },
  {
    id: "table-compare-multi",
    input: "對照：供應商甲：價格 88、交期 12、穩定 95；供應商乙：價格 76、交期 9、穩定 90",
    expectKind: "table",
  },
  {
    id: "table-compare-short",
    input: "方案：A：成本 10、速度 70；B：成本 12、速度 90",
    expectKind: "table",
  },
  {
    id: "table-compare-lines",
    input: "對照\n模型A：準確率 0.92、延遲 110\n模型B：準確率 0.90、延遲 85\n模型C：準確率 0.88、延遲 60",
    expectKind: "table",
  },
  {
    id: "table-multi-metric",
    input: "方案對照：方案A：轉換率 12、成本 100；方案B：轉換率 18、成本 80",
    expectKind: "table",
  },
  {
    id: "table-compare-compact-craft-meta",
    input:
      "方案對比\n預期產出為表格，且依成本欄排序\n方案A成本12、速度80、品質92；方案B成本9、速度70、品質88；方案C成本14、速度92、品質90",
    expectKind: "table",
    expectTableSortKey: "成本",
  },
  {
    id: "table-compare-compact-trailing-meta",
    input:
      "方案A成本12、速度80、品質92；方案B成本9、速度70、品質88；方案C成本14、速度92、品質90。預期產出為表格，且依成本欄排序",
    expectKind: "table",
    expectTableSortKey: "成本",
  },
  {
    id: "cn-percent-line",
    input: "第一週完成率為百分之六十五，第四週成長到百分之八十五",
    expectKind: "chart",
  },
  {
    id: "cn-season-line",
    input: "第一季一百萬、第二季一百二十萬、第三季一百五十萬、第四季一百八十萬",
    expectKind: "chart",
  },
  {
    id: "scheme-qualitative-table",
    input: "方案 A 成本較低但功能少，方案 B 平衡性佳，方案 C 功能最全但價格較高",
    expectKind: "table",
  },
  {
    id: "scheme-semicolon-courseflow",
    input:
      "使用表格視覺進行方案對比。人工製作教學影片，需時較長，但品質通常較好；使用AI自動化產出教學影片，效率最好，但品質上較不可控，且充滿「AI味」；採用CourseFlow為折衷方案，能夠兼顧品質與效率。",
    expectKind: "table",
  },
];

export function runGoldenCaseHeuristics(): {
  passed: number;
  failed: { id: string; reason: string }[];
} {
  const failed: { id: string; reason: string }[] = [];
  let passed = 0;
  for (const c of GOLDEN_CASES) {
    const cfg = inferVisualConfigFromText(c.input);
    if (!cfg) {
      failed.push({ id: c.id, reason: "no config" });
      continue;
    }
    const v = safeParseVisualConfig(cfg);
    if (!v.success) {
      failed.push({ id: c.id, reason: v.error });
      continue;
    }
    if (v.data.kind !== c.expectKind) {
      failed.push({ id: c.id, reason: `kind ${v.data.kind} !== ${c.expectKind}` });
      continue;
    }
    if (
      c.expectChartType &&
      v.data.kind === "chart" &&
      v.data.chartType !== c.expectChartType
    ) {
      failed.push({
        id: c.id,
        reason: `chartType ${v.data.chartType} !== ${c.expectChartType}`,
      });
      continue;
    }
    if (c.expectTableSortKey && v.data.kind === "table") {
      const key = (v.data as { sortBy?: { key?: string } }).sortBy?.key;
      if (key !== c.expectTableSortKey) {
        failed.push({
          id: c.id,
          reason: `sortBy.key ${String(key)} !== ${c.expectTableSortKey}`,
        });
        continue;
      }
    }
    passed += 1;
  }
  return { passed, failed };
}
