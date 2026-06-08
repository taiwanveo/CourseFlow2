import { motion } from "framer-motion";
import { MaskReveal } from "./MaskReveal";
import { VisualBlock, type VisualConfigProp } from "./VisualBlock";
import { ExplainAnimationSlot } from "./ExplainAnimationSlot";
import { ListRevealGrid, type ListRevealItem } from "./ListRevealGrid";
import { FlowDiagram } from "./FlowDiagram";
import { HookImageStrip } from "./HookImageStrip";
import type { MotionSceneConfig } from "./explain-motion-types";
import { isMotionSceneConfig } from "./explain-motion-types";
import type { StepDslChapterData, StepDslStepData } from "./step-dsl-types";
import { enterMotionVariants } from "./motion-presets";
import "./UniversalStepChapter.css";

type StepMediaHelpers = {
  stepImageUrl: (step: number) => string;
  hasStepAnimation: (step: number) => boolean;
  stepAnimationConfig: (step: number) => MotionSceneConfig | undefined;
  stepAnimationSrcDoc: (step: number) => string | undefined;
};

function resolveImageUrl(
  direct: string | undefined,
  imageStep: number | undefined,
  helpers: StepMediaHelpers,
): string | undefined {
  if (direct?.trim()) return direct.trim();
  if (imageStep !== undefined) return helpers.stepImageUrl(imageStep);
  return undefined;
}

function resolveAnim(
  step: number | undefined,
  config: Record<string, unknown> | undefined,
  html: string | undefined,
  helpers: StepMediaHelpers,
): {
  animationConfig?: MotionSceneConfig;
  animationHtml?: string;
} {
  if (config && isMotionSceneConfig(config)) {
    return { animationConfig: config };
  }
  if (html?.trim()) return { animationHtml: html };
  if (step !== undefined && helpers.hasStepAnimation(step)) {
    return {
      animationConfig: helpers.stepAnimationConfig(step),
      animationHtml: helpers.stepAnimationSrcDoc(step),
    };
  }
  return {};
}

function PerStepScene({
  stepDef,
  helpers,
}: {
  stepDef: StepDslStepData;
  helpers: StepMediaHelpers;
}) {
  const { enterAnimationId, transitionId } = stepDef.enter;
  const variants = enterMotionVariants[enterAnimationId] ?? enterMotionVariants["fade-up"];
  const anim = resolveAnim(
    stepDef.animationStep ?? stepDef.step,
    stepDef.explain as Record<string, unknown> | undefined,
    stepDef.animationHtml,
    helpers,
  );
  const imageUrl = resolveImageUrl(stepDef.imageUrl, stepDef.imageStep, helpers);

  if (stepDef.layout === "visual-focus" && stepDef.visual) {
    return (
      <motion.div
        className={`usd-step usd-visual cf-enter-${enterAnimationId}`}
        data-cf-transition={transitionId}
        variants={variants}
        initial="hidden"
        animate="show"
      >
        {stepDef.screen.headline ? (
          <header className="usd-headline masthead">
            <span className="serif-cn">{stepDef.screen.headline}</span>
          </header>
        ) : null}
        <VisualBlock
          step={stepDef.step}
          headline={stepDef.screen.sub}
          config={stepDef.visual as VisualConfigProp}
        />
      </motion.div>
    );
  }

  if (stepDef.layout === "explain-focus" && (anim.animationConfig || anim.animationHtml)) {
    return (
      <motion.div
        className={`usd-step usd-explain scene-pad cf-enter-${enterAnimationId}`}
        data-cf-transition={transitionId}
        variants={variants}
        initial="hidden"
        animate="show"
      >
        {stepDef.screen.headline ? (
          <h1 className="usd-screen serif-cn">{stepDef.screen.headline}</h1>
        ) : null}
        <ExplainAnimationSlot
          className="usd-anim-frame"
          animationConfig={anim.animationConfig}
          animationHtml={anim.animationHtml}
          title=""
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`usd-step usd-center scene-pad cf-enter-${enterAnimationId}`}
      data-cf-transition={transitionId}
      variants={variants}
      initial="hidden"
      animate="show"
    >
      <MaskReveal show duration={1100}>
        <h1 className="usd-screen serif-cn">{stepDef.screen.headline}</h1>
        {stepDef.screen.sub ? (
          <p className="usd-sub muted">{stepDef.screen.sub}</p>
        ) : null}
      </MaskReveal>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="usd-step-image" data-no-advance />
      ) : null}
      {anim.animationConfig || anim.animationHtml ? (
        <ExplainAnimationSlot
          className="usd-anim-frame"
          animationConfig={anim.animationConfig}
          animationHtml={anim.animationHtml}
          title=""
        />
      ) : null}
    </motion.div>
  );
}

export function UniversalStepChapter({
  step,
  chapter,
  stepImageUrl,
  hasStepAnimation,
  stepAnimationConfig,
  stepAnimationSrcDoc,
}: {
  step: number;
  chapter: StepDslChapterData;
  stepImageUrl: (step: number) => string;
  hasStepAnimation: (step: number) => boolean;
  stepAnimationConfig: (step: number) => MotionSceneConfig | undefined;
  stepAnimationSrcDoc: (step: number) => string | undefined;
}) {
  const helpers: StepMediaHelpers = {
    stepImageUrl,
    hasStepAnimation,
    stepAnimationConfig,
    stepAnimationSrcDoc,
  };
  const stepDef = chapter.steps[step];
  const motion = stepDef?.enter ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };

  if (chapter.chapterLayout === "list-reveal" && chapter.listBundle) {
    const lb = chapter.listBundle;
    const introAnim = resolveAnim(
      lb.introAnimationStep ?? 0,
      lb.introAnimationConfig,
      lb.introAnimationHtml,
      helpers,
    );
    const items: ListRevealItem[] = lb.items.map((it) => {
      const itemAnim = resolveAnim(
        it.animationStep,
        it.animationConfig,
        it.animationHtml,
        helpers,
      );
      return {
        num: it.num,
        title: it.title,
        body: it.body,
        imageUrl: resolveImageUrl(it.imageUrl, it.imageStep, helpers),
        animationConfig: itemAnim.animationConfig,
        animationHtml: itemAnim.animationHtml,
      };
    });
    return (
      <ListRevealGrid
        step={step}
        chapterTitle={chapter.kicker}
        introTitle={lb.introTitle}
        introSub={lb.introSub}
        items={items}
        kicker={chapter.kicker}
        introImageUrl={resolveImageUrl(lb.introImageUrl, lb.introImageStep, helpers)}
        introAnimationConfig={introAnim.animationConfig}
        introAnimationHtml={introAnim.animationHtml}
        enterAnimationId={motion.enterAnimationId}
        transitionId={motion.transitionId}
      />
    );
  }

  if (chapter.chapterLayout === "flow" && chapter.flowBundle) {
    const fb = chapter.flowBundle;
    const stepAnim = resolveAnim(step, undefined, undefined, helpers);
    return (
      <FlowDiagram
        step={step}
        chapterTitle={chapter.kicker}
        intro={fb.intro}
        introSub={fb.introSub}
        nodes={fb.nodes}
        stepImageUrl={step > 0 ? resolveImageUrl(undefined, step, helpers) : undefined}
        stepAnimationConfig={stepAnim.animationConfig}
        stepAnimationHtml={stepAnim.animationHtml}
        enterAnimationId={motion.enterAnimationId}
        transitionId={motion.transitionId}
      />
    );
  }

  if (chapter.chapterLayout === "hook" && chapter.hookBundle) {
    const hb = chapter.hookBundle;
    const slides = hb.slides.map((s, idx) => {
      const checkpoint = s.url?.trim() ?? null;
      const wvpStep = idx + 1;
      const fromPack = helpers.stepImageUrl(wvpStep);
      const url =
        checkpoint ??
        (fromPack && !fromPack.endsWith("/00.jpg") ? fromPack : idx === 0 ? helpers.stepImageUrl(0) : null);
      return { ...s, url };
    });
    return (
      <HookImageStrip
        step={step}
        chapterTitle={chapter.kicker}
        introKicker={hb.introKicker}
        slides={slides}
        takeoverTitle={hb.takeoverTitle}
        closeLine={hb.closeLine}
        includeClose={hb.includeClose}
        enterAnimationId={motion.enterAnimationId}
        transitionId={motion.transitionId}
      />
    );
  }

  if (!stepDef) return null;
  return <PerStepScene stepDef={stepDef} helpers={helpers} />;
}
