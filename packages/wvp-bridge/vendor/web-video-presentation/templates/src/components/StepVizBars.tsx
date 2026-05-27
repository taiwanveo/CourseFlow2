import "./StepVizBars.css";

/** 可程式化視覺演示：CSS 動畫長條圖（滿足 CHAPTER-CRAFT 每章至少一處動效） */
export function StepVizBars({
  label = "重點",
  values = [72, 48, 91, 63],
}: {
  label?: string;
  values?: number[];
}) {
  return (
    <div className="cf-viz-bars" data-no-advance aria-hidden>
      <p className="cf-viz-bars-label label-mono">{label}</p>
      <div className="cf-viz-bars-track">
        {values.map((v, i) => (
          <div key={i} className="cf-viz-bars-col">
            <div
              className="cf-viz-bars-fill"
              style={{ ["--h" as string]: `${Math.min(100, Math.max(8, v))}%`, ["--i" as string]: String(i) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
