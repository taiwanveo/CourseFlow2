import { useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import type { MotionSceneConfig } from "./explain-motion-types";
import { ExplainAnimationSlot } from "./ExplainAnimationSlot";
import { MaskReveal } from "./MaskReveal";
import { usePresentationMotion } from "../hooks/usePresentationMotion";
import {
  listSlotContentVariants,
  listSlotIntroVariants,
  listSlotLineVariants,
  listSlotVariants,
  listStaggerContainerWith,
  springReveal,
} from "./motion-presets";
import { StepEnterFrame } from "./StepEnterFrame";
import "./ListRevealGrid.css";

export type ListRevealItem = {
  num: string;
  title: string;
  body: string;
  imageUrl?: string;
  /** AI 解說動畫：自包含 HTML 字串（優先於 imageUrl） */
  animationHtml?: string;
  /** Phase 3：DSL → Framer Motion 場景（優先於 animationHtml） */
  animationConfig?: MotionSceneConfig;
  /** AI 解說動畫：項目 URL（和 animationHtml 二擇一，兩者同存時優先用 html） */
  animationUrl?: string;
};

export function ListRevealGrid({
  step,
  chapterTitle,
  introTitle,
  introSub,
  items,
  kicker,
  introImageUrl,
  introAnimationHtml,
  introAnimationConfig,
  introAnimationUrl,
  enterAnimationId = "fade-up",
  transitionId = "crossfade",
}: {
  step: number;
  chapterTitle: string;
  introTitle: string;
  introSub: string;
  items: ListRevealItem[];
  kicker?: string;
  /** 第 0 步（章節引子／分隔頁）配圖 */
  introImageUrl?: string;
  /** 第 0 步（章節引子／分隔頁）AI 動畫 HTML（打包內嵌，優先於 URL） */
  introAnimationHtml?: string;
  /** Phase 3：引子步 DSL Motion 場景 */
  introAnimationConfig?: MotionSceneConfig;
  /** @deprecated 請改用 introAnimationHtml */
  introAnimationUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const [introImgOk, setIntroImgOk] = useState(true);
  const { stagger } = usePresentationMotion();
  const introStagger = listStaggerContainerWith(stagger);

  if (step === 0) {
    const cols = Math.min(Math.max(items.length, 1), 4);
    const showIntroAnim = Boolean(introAnimationConfig || introAnimationHtml?.trim());
    const showIntroAnimLegacy = !showIntroAnim && Boolean(introAnimationUrl?.trim());
    const showIntroImg = !showIntroAnim && Boolean(introImageUrl?.trim()) && introImgOk;
    return (
      <StepEnterFrame
        enterAnimationId={enterAnimationId}
        className={`lr-scene scene-pad lr-intro cf-img-text-stack${showIntroAnim || showIntroAnimLegacy || showIntroImg ? " lr-intro--has-figure" : ""}`}
      >
        <header className="lr-masthead">
          <span className="lr-rule" />
          <span className="lr-kicker">{kicker ?? chapterTitle}</span>
          <span className="lr-rule" />
        </header>
        <div className="lr-intro-focus cf-img-text-stack__copy">
          <MaskReveal show duration={1100}>
            <h1 className="lr-intro-h serif-cn">{introTitle}</h1>
          </MaskReveal>
          {introSub ? (
            <MaskReveal show delay={400} duration={900}>
              <div className="lr-intro-sub">{introSub}</div>
            </MaskReveal>
          ) : null}
        </div>
        {showIntroAnim || showIntroAnimLegacy ? (
          <MaskReveal show delay={220} duration={900}>
            <div className="lr-intro-visual cf-img-text-stack__media cf-img-single" data-no-advance>
              <ExplainAnimationSlot
                className="lr-item-anim"
                animationConfig={introAnimationConfig}
                animationHtml={introAnimationHtml}
                animationUrl={introAnimationUrl}
                replayKey={`intro-${step}`}
                title={introTitle}
              />
            </div>
          </MaskReveal>
        ) : showIntroImg ? (
          <MaskReveal show delay={220} duration={900}>
            <div className="lr-intro-visual cf-img-text-stack__media cf-img-single" data-no-advance>
              <img
                className="lr-intro-img"
                src={introImageUrl}
                alt={introTitle}
                loading="eager"
                onError={() => setIntroImgOk(false)}
              />
            </div>
          </MaskReveal>
        ) : null}
        <motion.div
          className="lr-grid lr-grid-ghost"
          style={{ ["--lr-cols" as string]: String(cols) }}
          variants={introStagger}
          initial="hidden"
          animate="show"
        >
          {items.map((it, i) => (
            <Slot key={it.num} state="ghost" item={it} index={i} step={step} intro />
          ))}
        </motion.div>
      </StepEnterFrame>
    );
  }

  // step >= 1：同頁累積格狀揭示（不因配圖／動畫切換全屏 FeaturedCard）
  const activeIdx = step - 1;
  if (!items[activeIdx]) return null;

  const cols = Math.min(Math.max(items.length, 1), 4);
  return (
    <div className="lr-scene scene-pad lr-list-reveal" data-cf-transition="none">
      <header className="lr-masthead">
        <span className="lr-rule" />
        <span className="lr-kicker">{kicker ?? chapterTitle}</span>
        <span className="lr-rule" />
      </header>
      <div className="lr-grid" style={{ ["--lr-cols" as string]: String(cols) }}>
        {items.map((it, i) => (
          <Slot
            key={it.num}
            state={i < activeIdx ? "past" : i === activeIdx ? "active" : "ghost"}
            item={it}
            index={i}
            step={step}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  state,
  item,
  index = 0,
  step = 0,
  intro = false,
}: {
  state: "ghost" | "active" | "past";
  item: ListRevealItem;
  index?: number;
  step?: number;
  /** 引子頁 ghost 預覽：使用 intro stagger variants */
  intro?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const hasAnimation = Boolean(
    item.animationConfig || item.animationHtml?.trim() || item.animationUrl?.trim(),
  );
  const showImg = !hasAnimation && Boolean(item.imageUrl?.trim()) && imgOk;
  const showVisual = state === "active" && (hasAnimation || showImg);

  return (
    <motion.div
      className={`lr-slot lr-slot-${state}`}
      style={{ ["--lr-i" as string]: String(index) } as CSSProperties}
      variants={intro ? listSlotIntroVariants : listSlotVariants}
      initial={intro ? "hidden" : false}
      animate={intro ? "show" : state}
      layout
    >
      <div className="lr-slot-num hero-num">{item.num}</div>
      <div className="lr-slot-content">
        {state !== "ghost" ? (
          <motion.div
            key={`${item.num}-${state}`}
            variants={listSlotContentVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div className="lr-slot-title serif-cn" variants={listSlotLineVariants}>
              {item.title}
            </motion.div>
            {item.body?.trim() ? (
              <motion.div className="lr-slot-body" variants={listSlotLineVariants}>
                {item.body}
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}
      </div>
      {showVisual ? (
        <motion.div
          className="lr-slot-visual"
          data-no-advance
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={springReveal}
        >
          {hasAnimation ? (
            <ExplainAnimationSlot
              className="lr-item-anim"
              animationConfig={item.animationConfig}
              animationHtml={item.animationHtml}
              animationUrl={item.animationUrl}
              replayKey={`${step}-${index}`}
              title={item.title}
            />
          ) : (
            <img
              className="lr-slot-img"
              src={item.imageUrl}
              alt={item.title}
              loading="eager"
              onError={() => setImgOk(false)}
            />
          )}
        </motion.div>
      ) : null}
    </motion.div>
  );
}
