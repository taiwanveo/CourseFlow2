import { useEffect, useMemo, useState } from "react";
import { animate, motion } from "framer-motion";
import { usePresentationMotion } from "../hooks/usePresentationMotion";
import type { MotionSceneConfig } from "./explain-motion-types";
import {
  flowCardVariants,
  listStaggerContainer,
  listSlotLineVariants,
  springReveal,
} from "./motion-presets";
import "./ExplainMotionScene.css";

const MOTION_PATTERNS = new Set([
  "process_flow",
  "stagger_reveal",
  "checklist_ticks",
  "split_contrast",
  "counter_kpi",
  "percent_grow",
  "percent_shrink",
  "journey_a_to_b",
  "value_compare",
  "parts_merge",
  "bars_race",
  "amount_add",
  "funnel_narrow",
  "ratio_split",
  "pulse_highlight",
  "venn_overlap",
  "before_after_slider",
  "timeline_year",
  "sparkline_up",
]);

export function isExplainMotionPattern(pattern: string): boolean {
  return MOTION_PATTERNS.has(pattern);
}

function strList(params: Record<string, unknown>, key: string): string[] {
  const raw = params[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function ProcessFlowScene({ params }: { params: Record<string, unknown> }) {
  const steps = strList(params, "steps");
  const { reduce, springFlow } = usePresentationMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce || steps.length === 0) {
      setActive(Math.max(0, steps.length - 1));
      return;
    }
    setActive(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        window.clearInterval(id);
        return;
      }
      setActive(i);
    }, 900);
    return () => window.clearInterval(id);
  }, [steps.length, reduce]);

  return (
    <div className="exm-scene" data-no-advance>
      <div className="exm-flow-track">
        {steps.map((step, i) => {
          const state = i < active ? "done" : i === active ? "on" : "pending";
          return (
            <motion.div
              key={`${i}-${step}`}
              className={`exm-flow-card exm-flow-card--${state}`}
              variants={flowCardVariants}
              initial={false}
              animate={state}
              transition={springFlow}
            >
              {step}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StaggerListScene({
  params,
  checklist = false,
}: {
  params: Record<string, unknown>;
  checklist?: boolean;
}) {
  const items = strList(params, "items");
  const { reduce, stagger, springReveal } = usePresentationMotion();
  const hi = Math.max(0, items.length - 1);

  return (
    <div className="exm-scene" data-no-advance>
      <motion.ul
        className="exm-list"
        variants={listStaggerContainer}
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: stagger, delayChildren: reduce ? 0 : 0.2 }}
      >
        {items.map((text, i) => (
          <motion.li
            key={`${i}-${text}`}
            className={`exm-list-item${i === hi ? " exm-list-item--hi" : ""}`}
            variants={listSlotLineVariants}
            transition={springReveal}
          >
            {checklist ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springReveal, delay: reduce ? 0 : 0.15 + i * 0.08 }}
                aria-hidden
              >
                ✓{" "}
              </motion.span>
            ) : null}
            {text}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function SplitContrastScene({ params }: { params: Record<string, unknown> }) {
  const leftTitle = String(params.leftTitle ?? "A");
  const rightTitle = String(params.rightTitle ?? "B");
  const leftPoints = strList(params, "leftPoints");
  const rightPoints = strList(params, "rightPoints");
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <motion.div
        className="exm-split"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger, delayChildren: reduce ? 0 : 0.15 } },
        }}
      >
        <motion.div className="exm-split-col" variants={listSlotLineVariants} transition={springReveal}>
          <h4 className="serif-cn">{leftTitle}</h4>
          <ul>
            {leftPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </motion.div>
        <motion.div className="exm-split-col" variants={listSlotLineVariants} transition={springReveal}>
          <h4 className="serif-cn">{rightTitle}</h4>
          <ul>
            {rightPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </div>
  );
}

function CounterKpiScene({ params }: { params: Record<string, unknown> }) {
  const target = Number(params.target) || 0;
  const unit = String(params.unit ?? "%");
  const label = String(params.label ?? "");
  const { reduce } = usePresentationMotion();
  const [display, setDisplay] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(target);
      return;
    }
    setDisplay(0);
    const controls = animate(0, target, {
      duration: 1.35,
      ease: [0.25, 1, 0.5, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, reduce]);

  return (
    <div className="exm-scene exm-kpi" data-no-advance>
      <motion.div
        className="exm-kpi-value"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springReveal}
      >
        {display}
        {unit}
      </motion.div>
      {label ? <div className="exm-kpi-label serif-cn">{label}</div> : null}
    </div>
  );
}

function PercentBarScene({
  params,
  grow,
}: {
  params: Record<string, unknown>;
  grow: boolean;
}) {
  const before = Number(params.beforeValue) || 0;
  const after = Number(params.afterValue) || 0;
  const beforeLabel = String(params.beforeLabel ?? "原本");
  const afterLabel = String(params.afterLabel ?? "現在");
  const max = Math.max(before, after, 1);
  const { reduce, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <div className="exm-bars">
        <div className="exm-bar-wrap">
          <div className="exm-bar-num">{before}</div>
          <motion.div
            className="exm-bar"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: before / max }}
            transition={springReveal}
            style={{ height: 160 }}
          />
          <div className="exm-bar-label">{beforeLabel}</div>
        </div>
        <div className="exm-bar-wrap">
          <div className="exm-bar-num">{after}</div>
          <motion.div
            className={`exm-bar ${grow ? "exm-bar--grow" : "exm-bar--shrink"}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: after / max }}
            transition={{ ...springReveal, delay: reduce ? 0 : 0.35 }}
            style={{ height: 160 }}
          />
          <div className="exm-bar-label">{afterLabel}</div>
        </div>
      </div>
    </div>
  );
}

function JourneyScene({ params }: { params: Record<string, unknown> }) {
  const fromLabel = String(params.fromLabel ?? "A");
  const toLabel = String(params.toLabel ?? "B");
  const viaLabel = params.viaLabel ? String(params.viaLabel) : undefined;
  const { reduce, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <div className="exm-journey">
        <motion.span
          className="exm-journey-line"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.25, 1, 0.5, 1] }}
        />
        <motion.span
          className="exm-journey-node serif-cn"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springReveal}
        >
          {fromLabel}
        </motion.span>
        {viaLabel ? (
          <motion.span
            className="exm-journey-node serif-cn"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springReveal, delay: reduce ? 0 : 0.5 }}
          >
            {viaLabel}
          </motion.span>
        ) : null}
        <motion.span
          className="exm-journey-node serif-cn"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springReveal, delay: reduce ? 0 : 0.9 }}
        >
          {toLabel}
        </motion.span>
      </div>
    </div>
  );
}

function ValueCompareScene({ params }: { params: Record<string, unknown> }) {
  const left = Number(params.left) || 0;
  const right = Number(params.right) || 0;
  const leftLabel = String(params.leftLabel ?? "A");
  const rightLabel = String(params.rightLabel ?? "B");
  const unit = String(params.unit ?? "");
  const { reduce, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <div className="exm-compare">
        <motion.div
          className="exm-compare-box"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springReveal}
        >
          <div className="exm-compare-num">{left}{unit}</div>
          <div>{leftLabel}</div>
        </motion.div>
        <motion.span
          className="exm-compare-arrow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.35 }}
        >
          →
        </motion.span>
        <motion.div
          className="exm-compare-box exm-compare-box--to"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springReveal, delay: reduce ? 0 : 0.45 }}
        >
          <div className="exm-compare-num">{right}{unit}</div>
          <div>{rightLabel}</div>
        </motion.div>
      </div>
    </div>
  );
}

function numList(
  params: Record<string, unknown>,
  key: string,
): Array<{ label: string; value: number }> {
  const raw = params[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is { label: string; value: number } =>
      Boolean(x && typeof x === "object" && "label" in x && "value" in x),
    )
    .map((x) => ({
      label: String((x as { label: unknown }).label),
      value: Number((x as { value: unknown }).value) || 0,
    }));
}

function BarsRaceScene({ params }: { params: Record<string, unknown> }) {
  const points = numList(params, "points");
  const max = Math.max(...points.map((p) => p.value), 1);
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <motion.div
        className="exm-bars-race"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : stagger } },
        }}
      >
        {points.map((p) => (
          <motion.div key={p.label} className="exm-bars-race-row" variants={listSlotLineVariants} transition={springReveal}>
            <span className="exm-bars-race-label">{p.label}</span>
            <div className="exm-bars-race-track">
              <motion.span
                className="exm-bars-race-fill"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((p.value / max) * 100)}%` }}
                transition={springReveal}
              />
            </div>
            <span className="exm-bars-race-val">{p.value}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function AmountAddScene({ params }: { params: Record<string, unknown> }) {
  const before = Number(params.beforeValue) || 0;
  const delta = Number(params.delta) || 0;
  const after = Number(params.afterValue) || before + delta;
  const unit = String(params.unit ?? "");
  const { reduce, springReveal } = usePresentationMotion();
  const [display, setDisplay] = useState(reduce ? after : before);

  useEffect(() => {
    if (reduce) {
      setDisplay(after);
      return;
    }
    setDisplay(before);
    const controls = animate(before, after, {
      duration: 1.2,
      ease: [0.25, 1, 0.5, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [before, after, reduce]);

  return (
    <div className="exm-scene exm-amount" data-no-advance>
      <motion.div className="exm-amount-before" initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={springReveal}>
        {before}
        {unit}
      </motion.div>
      <motion.span className="exm-amount-plus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.4 }}>
        +{delta}
        {unit}
      </motion.span>
      <motion.div
        className="exm-amount-after"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...springReveal, delay: reduce ? 0 : 0.7 }}
      >
        {display}
        {unit}
      </motion.div>
    </div>
  );
}

function FunnelScene({ params }: { params: Record<string, unknown> }) {
  const stages = strList(params, "stages");
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <motion.div
        className="exm-funnel"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : stagger } },
        }}
      >
        {stages.map((stage, i) => (
          <motion.div
            key={`${i}-${stage}`}
            className="exm-funnel-stage"
            style={{ width: `${100 - i * 14}%` }}
            variants={listSlotLineVariants}
            transition={springReveal}
          >
            {stage}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function RatioSplitScene({ params }: { params: Record<string, unknown> }) {
  const raw = params.parts;
  const parts = Array.isArray(raw)
    ? raw
        .filter((x): x is { label: string; value: number } =>
          Boolean(x && typeof x === "object" && "label" in x),
        )
        .map((x) => ({
          label: String((x as { label: unknown }).label),
          value: Number((x as { value: unknown }).value) || 0,
        }))
    : [];
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <motion.div
        className="exm-ratio"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : stagger * 0.6 } },
        }}
      >
        {parts.map((p) => (
          <motion.div
            key={p.label}
            className="exm-ratio-seg"
            style={{ flexGrow: p.value }}
            variants={listSlotLineVariants}
            transition={springReveal}
          >
            <span>{p.label}</span>
            <small>{Math.round((p.value / total) * 100)}%</small>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function numPoints(params: Record<string, unknown>): { label: string; value: number }[] {
  const raw = params.points;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is { label: string; value: number } =>
      Boolean(x && typeof x === "object" && "label" in x && "value" in x),
    )
    .map((x) => ({
      label: String((x as { label: unknown }).label),
      value: Number((x as { value: unknown }).value) || 0,
    }));
}

function SparklineScene({ params }: { params: Record<string, unknown> }) {
  const points = numPoints(params);
  const unit = String(params.unit ?? "");
  const max = Math.max(...points.map((p) => p.value), 1);
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene exm-sparkline" data-no-advance>
      <motion.svg viewBox="0 0 480 220" className="exm-sparkline-svg">
        <motion.polyline
          className="exm-sparkline-line"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          points={points
            .map((p, i) => {
              const x = 60 + (i * 360) / Math.max(1, points.length - 1);
              const y = 180 - (p.value / max) * 120;
              return `${x},${y}`;
            })
            .join(" ")}
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.25, 1, 0.5, 1] }}
        />
        {points.map((p, i) => {
          const x = 60 + (i * 360) / Math.max(1, points.length - 1);
          const y = 180 - (p.value / max) * 120;
          return (
            <g key={`${p.label}-${i}`}>
              <motion.circle
                cx={x}
                cy={y}
                r="5"
                fill="var(--accent)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...springReveal, delay: reduce ? 0 : 0.5 + i * stagger }}
              />
              <text x={x} y={200} textAnchor="middle" className="exm-sparkline-label">
                {p.label}
              </text>
              <text x={x} y={y - 12} textAnchor="middle" className="exm-sparkline-val">
                {p.value}
              </text>
            </g>
          );
        })}
      </motion.svg>
      {unit ? <span className="exm-sparkline-unit muted">{unit}</span> : null}
    </div>
  );
}

function VennOverlapScene({ params }: { params: Record<string, unknown> }) {
  const leftLabel = String(params.leftLabel ?? "A").slice(0, 6);
  const rightLabel = String(params.rightLabel ?? "B").slice(0, 6);
  const overlapLabel = String(params.overlapLabel ?? "∩");
  const { springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene exm-venn" data-no-advance>
      <motion.div
        className="exm-venn-circle exm-venn-left"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 0.55, x: 0 }}
        transition={springReveal}
      >
        {leftLabel}
      </motion.div>
      <motion.div
        className="exm-venn-circle exm-venn-right"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 0.55, x: 0 }}
        transition={{ ...springReveal, delay: 0.35 }}
      >
        {rightLabel}
      </motion.div>
      <motion.div
        className="exm-venn-overlap"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ ...springReveal, delay: 0.75 }}
      >
        {overlapLabel}
      </motion.div>
    </div>
  );
}

function BeforeAfterSliderScene({ params }: { params: Record<string, unknown> }) {
  const beforeLabel = String(params.beforeLabel ?? "改造前").slice(0, 6);
  const afterLabel = String(params.afterLabel ?? "改造後").slice(0, 6);
  const { reduce } = usePresentationMotion();
  const [pos, setPos] = useState(reduce ? 0.5 : 0.82);

  useEffect(() => {
    if (reduce) {
      setPos(0.5);
      return;
    }
    setPos(0.82);
    const t1 = window.setTimeout(() => setPos(0.28), 500);
    const t2 = window.setTimeout(() => setPos(0.5), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduce]);

  const clipInset = `${(1 - pos) * 100}%`;
  const slideTransition = { duration: 0.85, ease: [0.25, 1, 0.5, 1] as const };

  return (
    <div className="exm-scene exm-before-after" data-no-advance>
      <div className="exm-ba-track">
        <div className="exm-ba-pane exm-ba-before">
          <span>{beforeLabel}</span>
        </div>
        <motion.div
          className="exm-ba-pane exm-ba-after"
          initial={false}
          animate={{ clipPath: `inset(0 ${clipInset} 0 0)` }}
          transition={slideTransition}
        >
          <span>{afterLabel}</span>
        </motion.div>
        <motion.div
          className="exm-ba-handle"
          initial={false}
          animate={{ left: `${pos * 100}%` }}
          transition={slideTransition}
        />
      </div>
    </div>
  );
}

function TimelineYearScene({ params }: { params: Record<string, unknown> }) {
  const raw = params.years;
  const years = Array.isArray(raw)
    ? raw
        .filter((x): x is { year: number; label?: string } =>
          Boolean(x && typeof x === "object" && "year" in x),
        )
        .map((x) => ({
          year: Number((x as { year: unknown }).year),
          label: (x as { label?: string }).label,
        }))
        .sort((a, b) => a.year - b.year)
    : [];
  const { reduce, stagger, springReveal } = usePresentationMotion();
  const [active, setActive] = useState(reduce ? years.length - 1 : 0);

  useEffect(() => {
    if (reduce || years.length === 0) return;
    setActive(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= years.length) {
        window.clearInterval(id);
        return;
      }
      setActive(i);
    }, 650);
    return () => window.clearInterval(id);
  }, [years.length, reduce]);

  return (
    <div className="exm-scene exm-timeline" data-no-advance>
      <div className="exm-timeline-rail" />
      <motion.div
        className="exm-timeline-nodes"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: reduce ? 0 : stagger } },
        }}
      >
        {years.map((y, i) => {
          const state = i <= active ? "on" : "pending";
          return (
            <motion.div
              key={y.year}
              className={`exm-timeline-node exm-timeline-node--${state}`}
              variants={listSlotLineVariants}
              transition={springReveal}
            >
              <span className="exm-timeline-year">{y.year}</span>
              {y.label ? <small>{y.label.slice(0, 6)}</small> : null}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function PulseHighlightScene({ params }: { params: Record<string, unknown> }) {
  const text = String(params.text ?? "");
  const sub = params.sub ? String(params.sub) : undefined;
  const { springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene exm-pulse" data-no-advance>
      <motion.div
        className="exm-pulse-ring"
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.2, 0.55] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="exm-pulse-text serif-cn"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springReveal}
      >
        {text}
        {sub ? <small>{sub}</small> : null}
      </motion.div>
    </div>
  );
}

function PartsMergeScene({ params }: { params: Record<string, unknown> }) {
  const count = Math.min(8, Math.max(2, Number(params.count) || 4));
  const label = String(params.label ?? "整合");
  const parts = useMemo(
    () => Array.from({ length: count }, (_, i) => `片段 ${i + 1}`),
    [count],
  );
  const { reduce, stagger, springReveal } = usePresentationMotion();

  return (
    <div className="exm-scene" data-no-advance>
      <motion.div
        className="exm-merge-parts"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger } },
        }}
      >
        {parts.map((p) => (
          <motion.span
            key={p}
            className="exm-merge-part"
            variants={listSlotLineVariants}
            transition={springReveal}
          >
            {p}
          </motion.span>
        ))}
      </motion.div>
      <motion.div
        className="exm-merge-core serif-cn"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...springReveal, delay: reduce ? 0 : 0.5 + count * 0.06 }}
      >
        {label}
      </motion.div>
    </div>
  );
}

export function ExplainMotionScene({ config }: { config: MotionSceneConfig }) {
  if (!isExplainMotionPattern(config.pattern)) return null;

  switch (config.pattern) {
    case "process_flow":
      return <ProcessFlowScene params={config.params} />;
    case "stagger_reveal":
      return <StaggerListScene params={config.params} />;
    case "checklist_ticks":
      return <StaggerListScene params={config.params} checklist />;
    case "split_contrast":
      return <SplitContrastScene params={config.params} />;
    case "counter_kpi":
      return <CounterKpiScene params={config.params} />;
    case "percent_grow":
      return <PercentBarScene params={config.params} grow />;
    case "percent_shrink":
      return <PercentBarScene params={config.params} grow={false} />;
    case "journey_a_to_b":
      return <JourneyScene params={config.params} />;
    case "value_compare":
      return <ValueCompareScene params={config.params} />;
    case "parts_merge":
      return <PartsMergeScene params={config.params} />;
    case "bars_race":
      return <BarsRaceScene params={config.params} />;
    case "amount_add":
      return <AmountAddScene params={config.params} />;
    case "funnel_narrow":
      return <FunnelScene params={config.params} />;
    case "ratio_split":
      return <RatioSplitScene params={config.params} />;
    case "pulse_highlight":
      return <PulseHighlightScene params={config.params} />;
    case "sparkline_up":
      return <SparklineScene params={config.params} />;
    case "venn_overlap":
      return <VennOverlapScene params={config.params} />;
    case "before_after_slider":
      return <BeforeAfterSliderScene params={config.params} />;
    case "timeline_year":
      return <TimelineYearScene params={config.params} />;
    default:
      return null;
  }
}
