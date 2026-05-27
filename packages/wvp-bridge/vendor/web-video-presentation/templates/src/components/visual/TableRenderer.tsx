import "./TableRenderer.css";
import {
  bestRowIndex,
  columnStats,
  formatCellValue,
  inferColumnMeta,
  toNumber,
  type ColumnMeta,
  type HighlightBest,
} from "./table-utils";

export type TableConfigProp = {
  kind: "table";
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  highlightColumn?: string;
  sortBy?: { key: string; direction?: "asc" | "desc" };
  highlightRowIndex?: number;
  emphasis?: "row" | "column" | "both";
  numericAlign?: "auto" | "right";
  reveal?: "row" | "column";
  columnMeta?: ColumnMeta[];
  highlightBest?: HighlightBest;
  density?: "compact" | "comfortable";
};

export function TableRenderer({ config, step }: { config: TableConfigProp; step: number }) {
  const rows = [...config.rows];
  const sortKey = config.sortBy?.key;
  const sortDir = config.sortBy?.direction ?? "desc";
  if (sortKey) {
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      const cmp = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const stats = columnStats(rows, config.columns);
  const metaByKey = new Map<string, ColumnMeta>();
  for (const col of config.columns) {
    const fromConfig = config.columnMeta?.find((m) => m.key === col.key);
    if (fromConfig) metaByKey.set(col.key, fromConfig);
    else {
      const samples = rows.map((r) => r[col.key]).slice(0, 12);
      metaByKey.set(col.key, inferColumnMeta(col.key, col.label, samples));
    }
  }

  const bestByKey = new Map<string, number>();
  if (config.highlightBest) {
    const idx = bestRowIndex(rows, config.highlightBest.key, config.highlightBest.direction);
    bestByKey.set(config.highlightBest.key, idx);
  } else {
    // 自動：對每個數值欄位標記最大值（常見於 cost/price/score）
    for (const col of config.columns) {
      const meta = metaByKey.get(col.key);
      if (!meta || meta.format === "text") continue;
      const st = stats.get(col.key);
      if (!st || st.max === st.min) continue;
      bestByKey.set(col.key, bestRowIndex(rows, col.key, "max"));
    }
  }

  const hiCol = config.highlightColumn;
  const hiRow = typeof config.highlightRowIndex === "number" ? config.highlightRowIndex : -1;
  const emphasize = config.emphasis ?? (hiCol && hiRow >= 0 ? "both" : hiCol ? "column" : hiRow >= 0 ? "row" : undefined);
  const alignRightDefault = config.numericAlign !== "auto" ? true : config.numericAlign === "right";
  const reveal = config.reveal ?? "row";
  const dense = config.density === "compact";

  return (
    <div className={`vf-table-wrap vf-table-card ${dense ? "vf-table-dense" : ""}`}>
      <h3 className="vf-title serif-cn">{config.title}</h3>
      <table className="vf-table vf-table-compare" role="table">
        <thead>
          <tr>
            {config.columns.map((col) => {
              const meta = metaByKey.get(col.key);
              const isHiCol =
                hiCol === col.key && (emphasize === "column" || emphasize === "both");
              return (
                <th key={col.key} className={isHiCol ? "vf-th vf-th-hi" : "vf-th"}>
                  <span className="vf-th-label">{col.label}</span>
                  {meta?.unit && meta.format !== "text" ? (
                    <span className="vf-th-unit">({meta.unit})</span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isHiRow = ri === hiRow && (emphasize === "row" || emphasize === "both");
            return (
              <tr
                key={ri}
                className={isHiRow ? "vf-tr vf-tr-hi" : "vf-tr"}
                style={{
                  animationDelay:
                    reveal === "row" ? `${ri * 55 + step * 15}ms` : `${step * 15}ms`,
                }}
              >
                {config.columns.map((col, ci) => {
                  const meta = metaByKey.get(col.key);
                  const raw = row[col.key];
                  const isBestCol = bestByKey.get(col.key) === ri;
                  const isHiColCell =
                    hiCol === col.key && (emphasize === "column" || emphasize === "both");
                  const n = meta && meta.format !== "text" ? toNumber(raw) : null;
                  const st = stats.get(col.key);
                  const showMiniBar =
                    meta?.miniBar && n !== null && st && st.max > 0;
                  const pct = showMiniBar ? Math.max(0, Math.min(1, n / st.max)) : 0;
                  const alignNum = alignRightDefault || meta?.format === "number" || meta?.format === "percent" || meta?.format === "currency";

                  return (
                    <td
                      key={col.key}
                      className={[
                        "vf-td",
                        isHiColCell ? "vf-td-hi" : "",
                        isBestCol ? "vf-td-best" : "",
                        alignNum ? "vf-td-num" : "",
                        showMiniBar ? "vf-td-barcell" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        animationDelay:
                          reveal === "column"
                            ? `${ci * 45 + ri * 12 + step * 10}ms`
                            : undefined,
                      }}
                    >
                      {col.key === "item" ? (
                        <span className="vf-cell vf-cell-text">{formatCellValue(raw, meta)}</span>
                      ) : showMiniBar ? (
                        <span className="vf-barcell">
                          <span className="vf-barcell-track" aria-hidden />
                          <span
                            className="vf-barcell-fill"
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                          <span className="vf-barcell-val">{formatCellValue(raw, meta)}</span>
                        </span>
                      ) : (
                        <span className="vf-cell">{formatCellValue(raw, meta)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
