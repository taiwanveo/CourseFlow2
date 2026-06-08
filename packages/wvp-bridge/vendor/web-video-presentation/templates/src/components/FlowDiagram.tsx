import { motion } from "framer-motion";
import type { MotionSceneConfig } from "./explain-motion-types";
import { ExplainAnimationSlot } from "./ExplainAnimationSlot";
import { MaskReveal } from "./MaskReveal";
import { StepEnterFrame } from "./StepEnterFrame";
import {
  flowCardVariants,
  flowConnectorTransition,
  springFlow,
} from "./motion-presets";
import "./FlowDiagram.css";

export type FlowNode = { id: string; label: string; detail: string };

/** 將「步驟二：撰寫文稿」拆成標題＋副標，避免整句塞進窄框 */
function normalizeFlowNode(node: FlowNode): FlowNode {
  if (node.detail.trim()) return node;
  const colon = node.label.match(/^步驟\s*([一二三四五六七八九十\d]+)\s*[：:]\s*(.+)$/);
  if (colon) {
    return {
      ...node,
      label: `步驟 ${colon[1]}`,
      detail: colon[2]!.trim(),
    };
  }
  return node;
}

type FlowConnectorProps = {
  lit: boolean;
  orient: "h" | "v";
};

function FlowConnector({ lit, orient }: FlowConnectorProps) {
  const isHorizontal = orient === "h";
  return (
    <div
      className="cf-flow-connector"
      data-orient={orient}
      data-lit={lit ? "true" : "false"}
      aria-hidden
    >
      <motion.span
        className="cf-flow-connector-line"
        initial={false}
        style={{
          transformOrigin: isHorizontal ? "left center" : "top center",
          ...(isHorizontal ? { top: "50%", y: "-50%" } : { left: "50%", x: "-50%" }),
        }}
        animate={isHorizontal ? { scaleX: lit ? 1 : 0 } : { scaleY: lit ? 1 : 0 }}
        transition={flowConnectorTransition}
      />
      <motion.span
        className="cf-flow-connector-head"
        initial={false}
        animate={{ opacity: lit ? 1 : 0.4 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      />
    </div>
  );
}

type FlowTrackProps = {
  nodes: FlowNode[];
  /** 目前點亮的節點索引；-1 表示全部待亮（分隔頁預覽） */
  active: number;
  preview?: boolean;
};

function FlowTrack({ nodes, active, preview = false }: FlowTrackProps) {
  if (nodes.length === 0) return null;

  const normalized = nodes.map(normalizeFlowNode);
  const count = normalized.length;
  /** 僅 3 節點用直向；4+ 改橫向展開，撐滿舞台寬高 */
  const stacked = count === 3;
  const denseHorizontal = count >= 4;

  return (
    <div
      className={`cf-flow-track${preview ? " cf-flow-track--preview" : ""}${stacked ? " cf-flow-track--stacked" : ""}${denseHorizontal ? " cf-flow-track--dense-h" : ""}`}
      data-nodes={normalized.length}
      role="list"
      aria-label="流程步驟"
      data-no-advance
    >
      {normalized.map((n, i) => {
        const state = i < active ? "done" : i === active ? "on" : "pending";
        const connectorLit = i > 0 && i <= active;
        return (
          <div key={n.id} className="cf-flow-segment" role="listitem">
            {i > 0 ? (
              <FlowConnector lit={connectorLit} orient={stacked ? "v" : "h"} />
            ) : null}
            <motion.div
              className={`cf-flow-card cf-flow-card--${state}`}
              variants={flowCardVariants}
              initial={false}
              animate={state}
              layout
              transition={springFlow}
            >
              <span className="cf-flow-card-num label-mono">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="cf-flow-card-label serif-cn">{n.label}</span>
              {n.detail.trim() ? (
                <span className="cf-flow-card-sub serif-cn">{n.detail}</span>
              ) : null}
            </motion.div>
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
  stepAnimationHtml,
  stepAnimationConfig,
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
  stepAnimationHtml?: string;
  /** Phase 3：DSL → Framer Motion 場景（優先於 HTML） */
  stepAnimationConfig?: MotionSceneConfig;
  /** @deprecated 請改用 stepAnimationHtml */
  stepAnimationUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const active = Math.max(0, step - 1);
  const normalizedNodes = nodes.map(normalizeFlowNode);
  const current = normalizedNodes[active];
  const hasAnimation = Boolean(
    stepAnimationConfig || stepAnimationHtml?.trim() || stepAnimationUrl?.trim(),
  );
  const hasImage = !hasAnimation && Boolean(stepImageUrl?.trim());
  const figure =
    hasAnimation || hasImage ? (
      <aside className="cf-flow-aside" data-no-advance>
        {hasAnimation ? (
          <ExplainAnimationSlot
            className="cf-flow-anim"
            animationConfig={stepAnimationConfig}
            animationHtml={stepAnimationHtml}
            animationUrl={stepAnimationUrl}
            replayKey={step}
            title={current?.label ?? intro}
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
      <StepEnterFrame
        enterAnimationId={enterAnimationId}
        className="cf-flow-scene scene-pad cf-flow-split"
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
      </StepEnterFrame>
    );
  }

  return (
    <div className="cf-flow-scene scene-pad cf-flow-split cf-flow-scene--steps">
      <div className="cf-flow-main">
        <div className="cf-flow-kicker label-mono">{chapterTitle}</div>
        <FlowTrack nodes={nodes} active={active} />
        {current?.detail?.trim() && nodes.length < 3 ? (
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
