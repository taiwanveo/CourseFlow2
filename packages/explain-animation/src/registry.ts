import type { ExplainPatternId } from "./schema.js";

export type ExplainPatternMeta = {
  id: ExplainPatternId;
  labelZh: string;
  category: string;
  /** 口播關鍵詞提示（供文件／除錯） */
  hint: string;
};

export const EXPLAIN_PATTERN_REGISTRY: ExplainPatternMeta[] = [
  { id: "percent_grow", labelZh: "百分比成長", category: "數值", hint: "增長/成長 X%" },
  { id: "percent_shrink", labelZh: "百分比縮減", category: "數值", hint: "縮減/下降 X%" },
  { id: "amount_add", labelZh: "數值加法", category: "數值", hint: "增加 X 萬" },
  { id: "amount_sub", labelZh: "數值減法", category: "數值", hint: "減少 X 萬" },
  { id: "value_compare", labelZh: "前後對照", category: "數值", hint: "從 A 到 B" },
  { id: "counter_kpi", labelZh: "KPI 計數", category: "數值", hint: "達到 X%" },
  { id: "ratio_split", labelZh: "比例分配", category: "數值", hint: "佔比/比例" },
  { id: "multiplier", labelZh: "倍數成長", category: "數值", hint: "翻倍/×N" },
  { id: "journey_a_to_b", labelZh: "A 到 B", category: "歷程", hint: "從…到…" },
  { id: "process_flow", labelZh: "流程步驟", category: "歷程", hint: "第一步/流程" },
  { id: "funnel_narrow", labelZh: "漏斗收斂", category: "歷程", hint: "漏斗/篩選" },
  { id: "milestone_path", labelZh: "里程碑路徑", category: "歷程", hint: "階段/里程碑" },
  { id: "balance_seesaw", labelZh: "翹翹板平衡", category: "對比", hint: "平衡/兩端" },
  { id: "split_contrast", labelZh: "左右對比", category: "對比", hint: "對比/兩種" },
  { id: "scale_compare", labelZh: "天平秤量", category: "對比", hint: "孰輕孰重" },
  { id: "spectrum_slider", labelZh: "光譜滑桿", category: "對比", hint: "介於兩者" },
  { id: "parts_merge", labelZh: "碎片聚合", category: "組合", hint: "整合/合併" },
  { id: "parts_split", labelZh: "整體拆解", category: "組合", hint: "拆分/分解" },
  { id: "layer_stack", labelZh: "層疊堆疊", category: "組合", hint: "層次/堆疊" },
  { id: "cluster_group", labelZh: "群組聚攏", category: "組合", hint: "聚集/群組" },
  { id: "sparkline_up", labelZh: "迷你折線", category: "趨勢", hint: "趨勢/曲線" },
  { id: "bars_race", labelZh: "長條賽跑", category: "趨勢", hint: "各項數值" },
  { id: "arc_progress", labelZh: "圓弧進度", category: "趨勢", hint: "完成度/進度" },
  { id: "pulse_highlight", labelZh: "脈衝強調", category: "強調", hint: "關鍵/重點" },
  { id: "ring_focus", labelZh: "光環聚焦", category: "強調", hint: "聚焦" },
  { id: "check_complete", labelZh: "完成勾選", category: "強調", hint: "完成/達成" },
  { id: "badge_unlock", labelZh: "徽章解鎖", category: "強調", hint: "解鎖/成就" },
  { id: "bridge_link", labelZh: "橋接連結", category: "連結", hint: "橋接/連接" },
  { id: "gap_close", labelZh: "差距縮小", category: "連結", hint: "縮小差距" },
  { id: "network_nodes", labelZh: "網路節點", category: "連結", hint: "節點/網路" },
  { id: "stagger_reveal", labelZh: "錯開揭示", category: "清單", hint: "依序出現" },
  { id: "checklist_ticks", labelZh: "清單勾選", category: "清單", hint: "條列/清單" },
  { id: "priority_rank", labelZh: "優先排序", category: "清單", hint: "優先/排序" },
  { id: "timeline_year", labelZh: "年份軸", category: "進階", hint: "2018年/2020年/歷程" },
  { id: "venn_overlap", labelZh: "集合交集", category: "進階", hint: "交集/重疊/共同" },
  { id: "before_after_slider", labelZh: "前後滑桿", category: "進階", hint: "改造前後/對照" },
  { id: "equation_balance", labelZh: "等式平衡", category: "進階", hint: "等於/方程式" },
];

export function listExplainPatterns(): ExplainPatternMeta[] {
  return EXPLAIN_PATTERN_REGISTRY;
}
