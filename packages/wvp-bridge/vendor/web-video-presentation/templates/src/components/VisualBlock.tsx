import { AnimationRenderer, type AnimationConfigProp } from "./visual/AnimationRenderer";
import { ChartRenderer, type ChartConfigProp } from "./visual/ChartRenderer";
import { TableRenderer, type TableConfigProp } from "./visual/TableRenderer";
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
    <div className="vf-block scene-pad">
      {headline ? (
        <header className="vf-headline masthead">
          <span className="vf-headline-text serif-cn">{headline}</span>
        </header>
      ) : null}
      {config.kind === "chart" ? (
        <ChartRenderer key={step} config={config} />
      ) : config.kind === "table" ? (
        <TableRenderer key={step} config={config} step={step} />
      ) : (
        <AnimationRenderer key={step} config={config} />
      )}
    </div>
  );
}
