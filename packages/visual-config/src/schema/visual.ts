import { z } from "zod";

const ChartConfig = z.object({
  kind: z.literal("chart"),
  chartType: z.enum(["bar", "line", "area", "pie", "kpi"]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  xKey: z.string().min(1),
  yKey: z.string().min(1),
  data: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
  unit: z.string().optional(),
  colorRole: z.enum(["sequential", "categorical", "highlight"]).default("categorical"),
  designNote: z.string().optional(),
});

const ColumnMetaSchema = z.object({
  key: z.string().min(1),
  format: z.enum(["text", "number", "percent", "currency"]).optional(),
  unit: z.string().optional(),
  /** 欄內 mini bar 熱力條（數值欄建議開啟） */
  miniBar: z.boolean().optional(),
});

const HighlightBestSchema = z.object({
  key: z.string().min(1),
  direction: z.enum(["max", "min"]),
});

const TableConfig = z.object({
  kind: z.literal("table"),
  title: z.string().min(1),
  columns: z.array(z.object({ key: z.string(), label: z.string() })).min(1),
  rows: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
  highlightColumn: z.string().optional(),
  columnMeta: z.array(ColumnMetaSchema).optional(),
  highlightBest: HighlightBestSchema.optional(),
  density: z.enum(["compact", "comfortable"]).default("comfortable").optional(),
  /**
   * 排序：renderer 會在顯示前排序 rows（不改原資料）。
   * - key 必須是 columns.key 之一
   * - direction：desc（預設）/ asc
   */
  sortBy: z
    .object({
      key: z.string().min(1),
      direction: z.enum(["asc", "desc"]).default("desc"),
    })
    .optional(),
  /**
   * 強調：更像 Stanford 風格「對照卡」
   * - highlightRowIndex：強調某一列
   * - highlightColumn：沿用既有欄位（亦可搭配使用）
   * - emphasis: "row" | "column" | "both"
   */
  highlightRowIndex: z.number().int().min(0).optional(),
  emphasis: z.enum(["row", "column", "both"]).optional(),
  /**
   * 呈現：對齊與格式（先做最常用的數值右對齊）
   */
  numericAlign: z.enum(["auto", "right"]).default("auto").optional(),
  reveal: z.enum(["row", "column"]).default("row").optional(),
});

const AnimationConfig = z.object({
  kind: z.literal("animation"),
  title: z.string().min(1),
  pattern: z.enum(["reveal-list", "process-flow", "callout"]),
  items: z
    .array(
      z.object({
        text: z.string().min(1),
        icon: z.string().optional(),
        emphasis: z.boolean().default(false),
      }),
    )
    .min(1),
});

export const VisualConfigSchema = z
  .discriminatedUnion("kind", [
  ChartConfig,
  TableConfig,
  AnimationConfig,
  ])
  .superRefine((v, ctx) => {
    if (v.kind === "chart") {
      const first = v.data[0] ?? {};
      if (!(v.xKey in first)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["xKey"],
          message: `data[0] 缺少 xKey 欄位：${v.xKey}`,
        });
      }
      if (!(v.yKey in first)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["yKey"],
          message: `data[0] 缺少 yKey 欄位：${v.yKey}`,
        });
      }
      for (let i = 0; i < v.data.length; i++) {
        const row = v.data[i] ?? {};
        const y = (row as Record<string, unknown>)[v.yKey];
        if (typeof y !== "number") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["data", i, v.yKey],
            message: "yKey 對應值必須是 number（單位請放 unit）",
          });
          break;
        }
      }
    }
    if (v.kind === "table") {
      const keys = new Set(v.columns.map((c) => c.key));
      const first = v.rows[0] ?? {};
      for (const c of v.columns) {
        if (!(c.key in first)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["columns"],
            message: `rows[0] 缺少欄位 key：${c.key}`,
          });
          break;
        }
      }
      if (v.highlightColumn && !keys.has(v.highlightColumn)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["highlightColumn"],
          message: "highlightColumn 必須是 columns.key 其中之一",
        });
      }
      if (v.sortBy && !keys.has(v.sortBy.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sortBy", "key"],
          message: "sortBy.key 必須是 columns.key 其中之一",
        });
      }
      if (
        typeof v.highlightRowIndex === "number" &&
        v.highlightRowIndex >= v.rows.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["highlightRowIndex"],
          message: "highlightRowIndex 超出 rows 範圍",
        });
      }
      if (v.highlightBest && !keys.has(v.highlightBest.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["highlightBest", "key"],
          message: "highlightBest.key 必須是 columns.key 其中之一",
        });
      }
      if (v.columnMeta) {
        for (let i = 0; i < v.columnMeta.length; i++) {
          const m = v.columnMeta[i]!;
          if (!keys.has(m.key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["columnMeta", i, "key"],
              message: "columnMeta.key 必須是 columns.key 其中之一",
            });
            break;
          }
        }
      }
    }
  });

export type VisualConfig = z.infer<typeof VisualConfigSchema>;
export type ChartVisualConfig = z.infer<typeof ChartConfig>;
export type TableVisualConfig = z.infer<typeof TableConfig>;
export type AnimationVisualConfig = z.infer<typeof AnimationConfig>;

export function parseVisualConfig(raw: unknown): VisualConfig {
  return VisualConfigSchema.parse(raw);
}

export function safeParseVisualConfig(
  raw: unknown,
): { success: true; data: VisualConfig } | { success: false; error: string } {
  const r = VisualConfigSchema.safeParse(raw);
  if (r.success) return { success: true, data: r.data };
  return { success: false, error: r.error.message };
}
