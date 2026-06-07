import { useState } from "react";
import type { CSSProperties } from "react";
import { MaskReveal } from "./MaskReveal";
import { SafeAnimationFrame } from "./SafeAnimationFrame";
import "./ListRevealGrid.css";

export type ListRevealItem = {
  num: string;
  title: string;
  body: string;
  imageUrl?: string;
  /** AI 解說動畫：自包含 HTML 字串（優先於 imageUrl） */
  animationHtml?: string;
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
  /** @deprecated 請改用 introAnimationHtml */
  introAnimationUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const [introImgOk, setIntroImgOk] = useState(true);

  if (step === 0) {
    const cols = Math.min(Math.max(items.length, 1), 4);
    const showIntroAnim = Boolean(introAnimationHtml?.trim());
    const showIntroAnimLegacy = !showIntroAnim && Boolean(introAnimationUrl?.trim());
    const showIntroImg = !showIntroAnim && Boolean(introImageUrl?.trim()) && introImgOk;
    return (
      <div
        className={`lr-scene scene-pad lr-intro cf-enter-${enterAnimationId}${showIntroAnim || showIntroAnimLegacy || showIntroImg ? " lr-intro--has-figure" : ""}`}
        data-cf-transition={transitionId}
      >
        <header className="lr-masthead">
          <span className="lr-rule" />
          <span className="lr-kicker">{kicker ?? chapterTitle}</span>
          <span className="lr-rule" />
        </header>
        <div className="lr-intro-focus">
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
            <div className="lr-intro-visual" data-no-advance>
              <SafeAnimationFrame
                className="lr-item-anim"
                srcDoc={introAnimationHtml}
                src={introAnimationHtml ? undefined : introAnimationUrl}
                sandbox="allow-scripts allow-same-origin"
                allow="autoplay"
                style={{ border: "none", width: "100%", height: "100%" }}
              />
            </div>
          </MaskReveal>
        ) : showIntroImg ? (
          <MaskReveal show delay={220} duration={900}>
            <div className="lr-intro-visual" data-no-advance>
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
        <div className="lr-grid lr-grid-ghost" style={{ ["--lr-cols" as string]: String(cols) }}>
          {items.map((it, i) => (
            <Slot key={it.num} state="ghost" item={it} index={i} />
          ))}
        </div>
      </div>
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
}: {
  state: "ghost" | "active" | "past";
  item: ListRevealItem;
  index?: number;
}) {
  const [imgOk, setImgOk] = useState(true);
  const hasAnimation = Boolean(item.animationHtml?.trim() || item.animationUrl?.trim());
  const showImg = !hasAnimation && Boolean(item.imageUrl?.trim()) && imgOk;
  const showVisual = state === "active" && (hasAnimation || showImg);

  return (
    <div
      className={`lr-slot lr-slot-${state}`}
      style={{ ["--lr-i" as string]: String(index) } as CSSProperties}
    >
      <div className="lr-slot-num hero-num">{item.num}</div>
      <div className="lr-slot-content">
        {state !== "ghost" && (
          <>
            <div className="lr-slot-title serif-cn">{item.title}</div>
            {item.body?.trim() ? (
              <div className="lr-slot-body">{item.body}</div>
            ) : null}
          </>
        )}
      </div>
      {showVisual ? (
        <div className="lr-slot-visual" data-no-advance>
          {hasAnimation ? (
            <SafeAnimationFrame
              className="lr-item-anim"
              srcDoc={item.animationHtml || undefined}
              src={item.animationHtml ? undefined : item.animationUrl}
              sandbox="allow-scripts allow-same-origin"
              title={item.title}
              loading="eager"
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
        </div>
      ) : null}
    </div>
  );
}
