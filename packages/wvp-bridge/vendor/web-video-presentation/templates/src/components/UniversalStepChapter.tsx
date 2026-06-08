import type { ReactNode } from "react";
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
import { parseStepDslChapterRuntime } from "./step-dsl-runtime";
import { StepTransitionFrame } from "./StepTransitionFrame";
import { enterMotionVariants } from "./motion-presets";
import "./UniversalStepChapter.css";

function resolveAnimFromDsl(
  explain?: Record<string, unknown>,
  animationHtml?: string,
): {
  animationConfig?: MotionSceneConfig;
  animationHtml?: string;
} {
  if (explain && isMotionSceneConfig(explain)) {
    return { animationConfig: explain };
  }
  if (animationHtml?.trim()) return { animationHtml };
  return {};
}

function resolveImageUrl(
  direct: string | undefined,
  imageStep: number | undefined,
  stepImageUrl: (step: number) => string,
): string | undefined {
  if (direct?.trim()) return direct.trim();
  if (imageStep !== undefined) return stepImageUrl(imageStep);
  return undefined;
}

function PerStepScene({
  stepDef,
  stepImageUrl,
}: {
  stepDef: StepDslStepData;
  stepImageUrl: (step: number) => string;
}) {
  const { enterAnimationId } = stepDef.enter;
  const variants = enterMotionVariants[enterAnimationId] ?? enterMotionVariants["fade-up"];
  const anim = resolveAnimFromDsl(
    stepDef.explain as Record<string, unknown> | undefined,
    stepDef.animationHtml,
  );
  const imageUrl = resolveImageUrl(stepDef.imageUrl, stepDef.imageStep, stepImageUrl);

  if (stepDef.layout === "visual-focus" && stepDef.visual) {
    return (
      <motion.div
        className={`usd-step usd-visual cf-enter-${enterAnimationId}`}
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
  chapter: rawChapter,
  stepImageUrl,
}: {
  step: number;
  chapter: StepDslChapterData;
  stepImageUrl: (step: number) => string;
}) {
  const chapter = parseStepDslChapterRuntime(rawChapter) ?? rawChapter;
  const stepDef = chapter.steps[step];
  const transitionId = stepDef?.enter.transitionId ?? "crossfade";
  const motion = stepDef?.enter ?? { enterAnimationId: "fade-up", transitionId: "crossfade" };

  let body: ReactNode = null;

  if (chapter.chapterLayout === "list-reveal" && chapter.listBundle) {
    const lb = chapter.listBundle;
    const introAnim = resolveAnimFromDsl(lb.introAnimationConfig, lb.introAnimationHtml);
    const items: ListRevealItem[] = lb.items.map((it) => {
      const itemAnim = resolveAnimFromDsl(it.animationConfig, it.animationHtml);
      return {
        num: it.num,
        title: it.title,
        body: it.body,
        imageUrl: resolveImageUrl(it.imageUrl, it.imageStep, stepImageUrl),
        animationConfig: itemAnim.animationConfig,
        animationHtml: itemAnim.animationHtml,
      };
    });
    body = (
      <ListRevealGrid
        step={step}
        chapterTitle={chapter.kicker}
        introTitle={lb.introTitle}
        introSub={lb.introSub}
        items={items}
        kicker={chapter.kicker}
        introImageUrl={resolveImageUrl(lb.introImageUrl, lb.introImageStep, stepImageUrl)}
        introAnimationConfig={introAnim.animationConfig}
        introAnimationHtml={introAnim.animationHtml}
        enterAnimationId={motion.enterAnimationId}
        transitionId={motion.transitionId}
      />
    );
  } else if (chapter.chapterLayout === "flow" && chapter.flowBundle) {
    const fb = chapter.flowBundle;
    const flowStep = chapter.steps[step];
    const stepAnim = resolveAnimFromDsl(
      flowStep?.explain as Record<string, unknown> | undefined,
      flowStep?.animationHtml,
    );
    body = (
      <FlowDiagram
        step={step}
        chapterTitle={chapter.kicker}
        intro={fb.intro}
        introSub={fb.introSub}
        nodes={fb.nodes}
        stepImageUrl={step > 0 ? resolveImageUrl(undefined, step, stepImageUrl) : undefined}
        stepAnimationConfig={stepAnim.animationConfig}
        stepAnimationHtml={stepAnim.animationHtml}
        enterAnimationId={motion.enterAnimationId}
        transitionId={motion.transitionId}
      />
    );
  } else if (chapter.chapterLayout === "hook" && chapter.hookBundle) {
    const hb = chapter.hookBundle;
    const slides = hb.slides.map((s, idx) => {
      const checkpoint = s.url?.trim() ?? null;
      const wvpStep = idx + 1;
      const fromPack = stepImageUrl(wvpStep);
      const url =
        checkpoint ??
        (fromPack && !fromPack.endsWith("/00.jpg") ? fromPack : idx === 0 ? stepImageUrl(0) : null);
      return { ...s, url };
    });
    body = (
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
  } else if (stepDef) {
    body = <PerStepScene stepDef={stepDef} stepImageUrl={stepImageUrl} />;
  }

  return (
    <StepTransitionFrame stepKey={step} transitionId={transitionId}>
      {body}
    </StepTransitionFrame>
  );
}
