import { motion } from "framer-motion";
import { AnimationRenderer, type AnimationConfigProp } from "./visual/AnimationRenderer";
import { ChartRenderer, type ChartConfigProp } from "./visual/ChartRenderer";
import { TableRenderer, type TableConfigProp } from "./visual/TableRenderer";
import { sceneBodyVariants, sceneHeadlineVariants } from "./motion-presets";
import "./VisualBlock.css";

export type VisualConfigProp =
  | ChartConfigProp
  | TableConfigProp
  | AnimationConfigProp;

export function VisualBlock({
  config,
  step,
  headline,
}: {
  config: VisualConfigProp;
  step: number;
  headline?: string;
}) {
  return (
    <motion.div
      className="vf-block scene-pad"
      variants={sceneBodyVariants}
      initial="hidden"
      animate="show"
      key={step}
    >
      {headline ? (
        <motion.header className="vf-headline masthead" variants={sceneHeadlineVariants}>
          <span className="vf-headline-text serif-cn">{headline}</span>
        </motion.header>
      ) : null}
      {config.kind === "chart" ? (
        <ChartRenderer key={step} config={config} />
      ) : config.kind === "table" ? (
        <TableRenderer key={step} config={config} step={step} />
      ) : (
        <AnimationRenderer
          key={step}
          config={config}
          activeItemIndex={
            config.pattern === "process-flow" || config.pattern === "reveal-list"
              ? step >= 1
                ? Math.min(step - 1, config.items.length - 1)
                : -1
              : undefined
          }
        />
      )}
    </motion.div>
  );
}
