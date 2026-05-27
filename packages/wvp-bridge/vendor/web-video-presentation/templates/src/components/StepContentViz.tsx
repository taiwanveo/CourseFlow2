import { useMemo } from "react";
import "./StepContentViz.css";

type VizKind = "list" | "bars" | "keywords";

function parseNarrationForViz(narration: string, hint?: string): {
  kind: VizKind;
  label: string;
  items: { text: string; value?: number }[];
} {
  const text = `${hint ?? ""} ${narration}`.trim();
  const label = narration.slice(0, 28).trim() || "本步重點";

  const numHits = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(%|％|倍|項|個|章|步)?/g)];
  if (numHits.length >= 2) {
    const items = numHits.slice(0, 5).map((m, i) => ({
      text: text.slice(Math.max(0, (m.index ?? 0) - 6), (m.index ?? 0) + 8).trim() || `重點 ${i + 1}`,
      value: Math.min(100, Math.max(12, Number(m[1]) * (m[2]?.includes("%") || m[2]?.includes("％") ? 1 : 8))),
    }));
    return { kind: "bars", label, items };
  }

  const parts = text
    .split(/[、，,；;]|(?:\d+[.)．、]\s*)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 40);
  if (parts.length >= 2) {
    return { kind: "list", label, items: parts.slice(0, 6).map((t) => ({ text: t })) };
  }

  const words = text.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
  const uniq = [...new Set(words)].slice(0, 5);
  return {
    kind: "keywords",
    label,
    items: (uniq.length ? uniq : [label]).map((t) => ({ text: t })),
  };
}

/** 依本章口播內容動態選擇視覺形式（清單揭示 / 數據長條 / 關鍵詞群） */
export function StepContentViz({
  narration,
  hint,
}: {
  narration: string;
  hint?: string;
}) {
  const viz = useMemo(() => parseNarrationForViz(narration, hint), [narration, hint]);

  if (viz.kind === "bars") {
    return (
      <div className="cf-content-viz cf-content-viz--bars" data-no-advance aria-hidden>
        <p className="cf-content-viz-label label-mono">{viz.label}</p>
        <div className="cf-content-viz-bars-track">
          {viz.items.map((it, i) => (
            <div key={i} className="cf-content-viz-bar-col">
              <div
                className="cf-content-viz-bar-fill"
                style={{
                  ["--h" as string]: `${it.value ?? 40}%`,
                  ["--i" as string]: String(i),
                }}
              />
              <span className="cf-content-viz-bar-cap">{it.text.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viz.kind === "list") {
    return (
      <ul className="cf-content-viz cf-content-viz--list" data-no-advance aria-hidden>
        {viz.items.map((it, i) => (
          <li key={i} className="cf-content-viz-list-item" style={{ ["--i" as string]: String(i) }}>
            <span className="cf-content-viz-list-dot" />
            <span className="serif-cn">{it.text}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="cf-content-viz cf-content-viz--keywords" data-no-advance aria-hidden>
      {viz.items.map((it, i) => (
        <span
          key={i}
          className="cf-content-viz-kw"
          style={{ ["--i" as string]: String(i) }}
        >
          {it.text}
        </span>
      ))}
    </div>
  );
}
