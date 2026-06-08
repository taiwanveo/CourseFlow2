import { isMotionSceneConfig, type MotionSceneConfig } from "./explain-motion-types";
import { ExplainMotionScene } from "./ExplainMotionScene";
import { SafeAnimationFrame } from "./SafeAnimationFrame";

/**
 * 解說動畫統一入口：Phase 3 優先 Framer Motion DSL 場景，否則回退 iframe HTML。
 */
export function ExplainAnimationSlot({
  animationConfig,
  animationHtml,
  animationUrl,
  className,
  title,
  /** 步驟索引：每次進入該步時重播動畫（避免沿用上一輪的靜態終態） */
  replayKey,
}: {
  animationConfig?: MotionSceneConfig | null;
  animationHtml?: string;
  animationUrl?: string;
  className?: string;
  title?: string;
  replayKey?: number | string;
}) {
  const config =
    animationConfig && isMotionSceneConfig(animationConfig) ? animationConfig : null;

  if (config) {
    return (
      <div className={className} data-no-advance>
        <ExplainMotionScene key={replayKey ?? config.pattern} config={config} />
      </div>
    );
  }

  const hasHtml = Boolean(animationHtml?.trim() || animationUrl?.trim());
  if (!hasHtml) return null;

  return (
    <SafeAnimationFrame
      key={replayKey}
      className={className}
      srcDoc={animationHtml}
      src={animationHtml ? undefined : animationUrl}
      sandbox="allow-scripts allow-same-origin"
      title={title}
      loading="eager"
    />
  );
}
