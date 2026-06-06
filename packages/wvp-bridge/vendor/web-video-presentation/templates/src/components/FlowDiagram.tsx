import { MaskReveal } from "./MaskReveal";
import "./FlowDiagram.css";

export type FlowNode = { id: string; label: string; detail: string };

export function FlowDiagram({
  step,
  chapterTitle,
  intro,
  introSub,
  nodes,
  stepImageUrl,
  enterAnimationId = "fade-up",
  transitionId = "crossfade",
}: {
  step: number;
  chapterTitle: string;
  intro: string;
  introSub?: string;
  nodes: FlowNode[];
  stepImageUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const active = Math.max(0, step - 1);
  const current = nodes[active];
  const figure =
    stepImageUrl?.trim() ? (
      <aside className="cf-flow-aside" data-no-advance>
        <img
          className="cf-flow-hero-img"
          src={stepImageUrl}
          alt=""
          loading="eager"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </aside>
    ) : null;

  if (step === 0) {
    return (
      <div
        className={`cf-flow-scene scene-pad cf-flow-split cf-enter-${enterAnimationId}`}
        data-cf-transition={transitionId}
      >
        <div className="cf-flow-main">
          <div className="cf-flow-kicker label-mono">{chapterTitle}</div>
          <h1 className="cf-flow-intro serif-cn">
            <MaskReveal show duration={1000}>
              <span>{intro}</span>
            </MaskReveal>
            {introSub?.trim() ? (
              <>
                <br />
                <MaskReveal show delay={400} duration={900}>
                  <span className="cf-flow-intro-accent">{introSub}</span>
                </MaskReveal>
              </>
            ) : null}
          </h1>
          <div className="cf-flow-preview" aria-hidden data-no-advance>
            {nodes.map((n, i) => (
              <span key={n.id} className="cf-flow-pill">
                {String(i + 1).padStart(2, "0")} {n.label}
              </span>
            ))}
          </div>
        </div>
        {figure}
      </div>
    );
  }

  // step >= 1 為同頁流程推進：勿重跑整頁 cf-enter
  return (
    <div className="cf-flow-scene scene-pad cf-flow-split" data-cf-transition="none">
      <div className="cf-flow-main">
        <div className="cf-flow-kicker label-mono">{chapterTitle}</div>
        <svg
          className="cf-flow-svg"
          viewBox={`0 0 ${Math.max(nodes.length * 200, 400)} 120`}
          aria-hidden
          data-no-advance
        >
          {nodes.map((n, i) => {
            const x = 80 + i * 180;
            const on = i <= active;
            return (
              <g key={n.id} className={on ? "cf-flow-node cf-flow-node--on" : "cf-flow-node"}>
                {i < nodes.length - 1 && (
                  <line
                    x1={x + 50}
                    y1={50}
                    x2={x + 130}
                    y2={50}
                    className="cf-flow-edge"
                    style={{
                      strokeDasharray: "120",
                      strokeDashoffset: on ? "0" : "120",
                    }}
                  />
                )}
                <rect x={x - 40} y={20} width={100} height={60} rx={6} className="cf-flow-box" />
                <text x={x + 10} y={55} className="cf-flow-label">
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
        {current?.detail?.trim() ? (
          <div className="cf-flow-detail-wrap">
            <MaskReveal show duration={900}>
              <p className="cf-flow-detail serif-cn">{current.detail}</p>
            </MaskReveal>
          </div>
        ) : null}
      </div>
      {figure}
    </div>
  );
}
