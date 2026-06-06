import { MaskReveal } from "./MaskReveal";
import "./FlowDiagram.css";

export type FlowNode = { id: string; label: string; detail: string };

type FlowTrackProps = {
  nodes: FlowNode[];
  /** 目前點亮的節點索引；-1 表示全部待亮（分隔頁預覽） */
  active: number;
  preview?: boolean;
};

function FlowTrack({ nodes, active, preview = false }: FlowTrackProps) {
  if (nodes.length === 0) return null;

  return (
    <div
      className={`cf-flow-track${preview ? " cf-flow-track--preview" : ""}`}
      role="list"
      aria-label="流程步驟"
      data-no-advance
    >
      {nodes.map((n, i) => {
        const state = i < active ? "done" : i === active ? "on" : "pending";
        const connectorLit = i > 0 && i <= active;
        return (
          <div key={n.id} className="cf-flow-segment" role="listitem">
            {i > 0 ? (
              <div
                className="cf-flow-connector"
                data-lit={connectorLit ? "true" : "false"}
                aria-hidden
              >
                <span className="cf-flow-connector-line" />
                <span className="cf-flow-connector-head" />
              </div>
            ) : null}
            <div className={`cf-flow-card cf-flow-card--${state}`}>
              <span className="cf-flow-card-num label-mono">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="cf-flow-card-label serif-cn" title={n.label}>
                {n.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FlowDiagram({
  step,
  chapterTitle,
  intro,
  introSub,
  nodes,
  stepImageUrl,
  stepAnimationUrl,
  enterAnimationId = "fade-up",
  transitionId = "crossfade",
}: {
  step: number;
  chapterTitle: string;
  intro: string;
  introSub?: string;
  nodes: FlowNode[];
  stepImageUrl?: string;
  stepAnimationUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const active = Math.max(0, step - 1);
  const current = nodes[active];
  const hasAnimation = Boolean(stepAnimationUrl?.trim());
  const hasImage = !hasAnimation && Boolean(stepImageUrl?.trim());
  const figure =
    hasAnimation || hasImage ? (
      <aside className="cf-flow-aside" data-no-advance>
        {hasAnimation ? (
          <iframe
            className="cf-flow-anim"
            src={stepAnimationUrl}
            sandbox="allow-scripts allow-same-origin"
            title={current?.label ?? intro}
            loading="eager"
          />
        ) : (
          <img
            className="cf-flow-hero-img"
            src={stepImageUrl}
            alt=""
            loading="eager"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
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
          <FlowTrack nodes={nodes} active={-1} preview />
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
        <FlowTrack nodes={nodes} active={active} />
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
