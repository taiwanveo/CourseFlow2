import { MaskReveal } from "../MaskReveal";
import "./AnimationRenderer.css";

export type AnimationConfigProp = {
  kind: "animation";
  title: string;
  pattern: "reveal-list" | "process-flow" | "callout";
  items: { text: string; icon?: string; emphasis?: boolean }[];
};

export function AnimationRenderer({ config }: { config: AnimationConfigProp }) {
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
  return (
    <div className={`vf-anim ${isFlow ? "vf-flow" : "vf-reveal-list"}`}>
      <h3 className="vf-title serif-cn">{config.title}</h3>
      <ol className={isFlow ? "vf-flow-steps" : "vf-reveal-items"}>
        {config.items.map((item, i) => (
          <li
            key={i}
            className={item.emphasis ? "vf-item vf-item-hi" : "vf-item"}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {isFlow ? <span className="vf-step-num">{String(i + 1).padStart(2, "0")}</span> : null}
            {item.icon ? <span className="vf-icon">{item.icon}</span> : null}
            <span className="vf-item-text">{item.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
