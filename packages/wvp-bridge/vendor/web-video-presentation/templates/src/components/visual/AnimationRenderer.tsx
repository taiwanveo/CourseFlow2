import { motion } from "framer-motion";
import { MaskReveal } from "../MaskReveal";
import { animItemVariants, listStaggerContainer, springFlow } from "../motion-presets";
import { flowCardVariants } from "../motion-presets";
import { usePresentationMotion } from "../../hooks/usePresentationMotion";
import "./AnimationRenderer.css";

export type AnimationConfigProp = {
  kind: "animation";
  title: string;
  pattern: "reveal-list" | "process-flow" | "callout";
  items: { text: string; icon?: string; emphasis?: boolean }[];
};

export function AnimationRenderer({
  config,
  activeItemIndex,
}: {
  config: AnimationConfigProp;
  /** process-flow / reveal-list：只點亮當前步驟（0-based 內容步） */
  activeItemIndex?: number;
}) {
  const { stagger, springReveal } = usePresentationMotion();

  if (config.pattern === "callout") {
    const item = config.items[0];
    return (
      <div className="vf-anim vf-callout">
        <MaskReveal show duration={900}>
          <blockquote className="vf-callout-text serif-cn">
            {item?.icon ? <span className="vf-icon">{item.icon}</span> : null}
            {item?.text ?? config.title}
          </blockquote>
        </MaskReveal>
      </div>
    );
  }

  const isFlow = config.pattern === "process-flow";
  const highlightIndex =
    typeof activeItemIndex === "number" && activeItemIndex >= 0
      ? activeItemIndex
      : config.items.findIndex((item) => item.emphasis);

  const listBody = config.items.map((item, i) => {
    const hi = i === highlightIndex;
    const flowState = hi ? "on" : i < highlightIndex ? "done" : "pending";
    return (
      <motion.li
        key={i}
        className={hi ? "vf-item vf-item-hi" : "vf-item"}
        variants={isFlow ? flowCardVariants : animItemVariants}
        initial={isFlow ? "pending" : "hidden"}
        animate={isFlow ? flowState : "show"}
        transition={isFlow ? springFlow : springReveal}
      >
        {isFlow ? (
          <span className="vf-step-num">{String(i + 1).padStart(2, "0")}</span>
        ) : null}
        {item.icon ? <span className="vf-icon">{item.icon}</span> : null}
        <span className="vf-item-text">{item.text}</span>
      </motion.li>
    );
  });

  return (
    <div className={`vf-anim ${isFlow ? "vf-flow" : "vf-reveal-list"}`}>
      <h3 className="vf-title serif-cn">{config.title}</h3>
      {isFlow ? (
        <ol className="vf-flow-steps">{listBody}</ol>
      ) : (
        <motion.ol
          className="vf-reveal-items"
          variants={listStaggerContainer}
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: stagger, delayChildren: 0.1 }}
        >
          {listBody}
        </motion.ol>
      )}
    </div>
  );
}
