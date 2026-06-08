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
}: {
  animationConfig?: MotionSceneConfig | null;
  animationHtml?: string;
  animationUrl?: string;
  className?: string;
  title?: string;
}) {
  const config =
    animationConfig && isMotionSceneConfig(animationConfig) ? animationConfig : null;

  if (config) {
    return (
      <div className={className} data-no-advance>
        <ExplainMotionScene config={config} />
      </div>
    );
  }

  const hasHtml = Boolean(animationHtml?.trim() || animationUrl?.trim());
  if (!hasHtml) return null;

  return (
    <SafeAnimationFrame
      className={className}
      srcDoc={animationHtml}
      src={animationHtml ? undefined : animationUrl}
      sandbox="allow-scripts allow-same-origin"
      title={title}
      loading="eager"
    />
  );
}
