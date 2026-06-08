import { useState } from "react";
import { motion } from "framer-motion";
import { usePresentationMotion } from "../hooks/usePresentationMotion";
import { MaskReveal } from "./MaskReveal";
import { StepEnterFrame } from "./StepEnterFrame";
import {
  hookGhostVariants,
  hookMiniVariants,
  hookSoloVariants,
  listStaggerContainerWith,
  springReveal,
} from "./motion-presets";
import { imageGridCountClass } from "../lib/imageLayout";
import "./HookImageStrip.css";

export type HookSlide = {
  url: string | null;
  alt: string;
  caption: string;
  label: string;
};

/** 依字數自適應字級（與 Beat-Scene 同尺度，長文不撐爆畫面） */
function hkTextTone(text: string): "hero" | "md" | "lg" | "compact" {
  const len = text.replace(/\s+/g, "").length;
  if (len <= 12) return "hero";
  if (len <= 20) return "md";
  if (len <= 32) return "lg";
  return "compact";
}

function SoloImage({ slide }: { slide: HookSlide }) {
  const [broken, setBroken] = useState(false);
  if (slide.url && !broken) {
    return (
      <img
        className="hk-solo-img"
        src={slide.url}
        alt={slide.alt || slide.caption}
        onError={() => setBroken(true)}
      />
    );
  }
  const caption = slide.caption?.trim() || slide.alt?.trim();
  if (caption) {
    const tone = hkTextTone(caption);
    return (
      <div className="hk-placeholder hk-placeholder--screen" aria-hidden>
        <span className={`hk-placeholder-screen serif-cn hk-text--${tone}`}>{caption}</span>
      </div>
    );
  }
  return (
    <div className="hk-placeholder" aria-hidden>
      <span className="hk-placeholder-label">待配圖</span>
    </div>
  );
}

/** Hook 多圖開場：ghost → 逐張全屏 → takeover（+ 可選收束） */
export function HookImageStrip({
  step,
  chapterTitle,
  introKicker,
  slides,
  takeoverTitle,
  closeLine,
  includeClose,
  enterAnimationId = "fade-up",
  transitionId = "crossfade",
}: {
  step: number;
  chapterTitle: string;
  introKicker: string;
  slides: HookSlide[];
  takeoverTitle: string;
  closeLine?: string;
  includeClose: boolean;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const n = slides.length;
  const takeoverStep = 1 + n;
  const closeStep = includeClose ? takeoverStep + 1 : -1;
  const takeoverText = takeoverTitle?.trim() ?? "";
  const { stagger } = usePresentationMotion();
  const hookStagger = listStaggerContainerWith(stagger, 0.12);

  if (step === 0) {
    return (
      <StepEnterFrame enterAnimationId={enterAnimationId} className="hk-scene scene-pad">
        <div className="hk-kicker">
          <span className="hk-kicker-line" />
          <span className="hk-kicker-text">{introKicker || chapterTitle}</span>
        </div>
        <motion.div
          className={`hk-grid cf-img-grid ${imageGridCountClass(slides.length)}`}
          variants={hookStagger}
          initial="hidden"
          animate="show"
        >
          {slides.map((s, idx) => {
            const caption = s.caption?.trim() ?? "";
            const textOnly = !s.url && caption.length > 0;
            return (
              <motion.div key={s.label} variants={hookGhostVariants} className="hk-grid-item">
                <div
                  className={`cf-img-cell hk-ghost${s.url ? " cf-img-cell--has-img" : ""}${
                    textOnly ? " cf-img-cell--text-only" : ""
                  }`}
                >
                  <span className="cf-img-cell__index hk-ghost-num">
                    {s.label.split("/")[0]?.trim() || String(idx + 1)}
                  </span>
                  <div className="cf-img-cell__media hk-ghost-media">
                    {s.url ? (
                      <img className="hk-ghost-thumb" src={s.url} alt="" loading="eager" />
                    ) : textOnly ? null : (
                      <span className="cf-img-cell__placeholder hk-ghost-label">待配圖</span>
                    )}
                  </div>
                  {caption ? (
                    <span className="cf-img-cell__caption hk-ghost-caption serif-cn">{caption}</span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </StepEnterFrame>
    );
  }

  if (step >= 1 && step <= n) {
    const s = slides[step - 1]!;
    return (
      <StepEnterFrame enterAnimationId={enterAnimationId} className="hk-scene scene-pad">
        <div className="hk-solo-frame cf-img-text-stack">
          <div className="cf-img-text-stack__media cf-img-single">
            <motion.div
              className="hk-solo-img-wrap"
              variants={hookSoloVariants}
              initial="hidden"
              animate="show"
            >
              <SoloImage slide={s} />
              <motion.div
                className="hk-stamp"
                initial={{ opacity: 0, scale: 2.2, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: -8 }}
                transition={{ ...springReveal, delay: 0.5 }}
              >
                重點
              </motion.div>
            </motion.div>
          </div>
          <MaskReveal show delay={400} duration={900}>
            <div className="cf-img-text-stack__copy hk-solo-meta">
              <span className="hk-solo-label">{s.label}</span>
              <span className="hk-solo-caption serif-cn">{s.caption}</span>
            </div>
          </MaskReveal>
        </div>
      </StepEnterFrame>
    );
  }

  if (step === takeoverStep) {
    const heroText = takeoverText || chapterTitle.trim() || introKicker.trim();
    const tone = hkTextTone(heroText);
    return (
      <StepEnterFrame
        enterAnimationId={enterAnimationId}
        className="hk-scene scene-pad hk-takeover cf-img-text-stack"
      >
        <motion.div
          className={`hk-mini-row cf-img-grid ${imageGridCountClass(slides.length)} cf-img-text-stack__media`}
          variants={hookStagger}
          initial="hidden"
          animate="show"
        >
          {slides.map((s) =>
            s.url ? (
              <motion.img
                key={s.label}
                className="hk-mini"
                src={s.url}
                alt={s.alt}
                variants={hookMiniVariants}
              />
            ) : (
              <motion.div key={s.label} className="hk-mini hk-mini-ph" variants={hookMiniVariants} />
            ),
          )}
        </motion.div>
        {heroText ? (
          <>
            <motion.span
              className="hk-accent-bar"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
              style={{ transformOrigin: "center" }}
            />
            <h1 className={`hk-hero cf-img-text-stack__copy hk-text--${tone}`}>
              <MaskReveal show duration={1100}>
                <span className="serif-cn">{heroText}</span>
              </MaskReveal>
            </h1>
          </>
        ) : null}
      </StepEnterFrame>
    );
  }

  if (includeClose && step === closeStep && closeLine?.trim()) {
    const tone = hkTextTone(closeLine);
    return (
      <StepEnterFrame enterAnimationId={enterAnimationId} className="hk-scene scene-pad hk-close">
        <div className="hk-quote-wrap">
          <h2 className={`hk-quote serif-cn hk-text--${tone}`}>{closeLine}</h2>
          <motion.span
            className="hk-brush"
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
            style={{ transformOrigin: "left center" }}
          />
        </div>
      </StepEnterFrame>
    );
  }

  return null;
}
