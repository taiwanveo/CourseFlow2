import { useState } from "react";
import type { CSSProperties } from "react";
import { MaskReveal } from "./MaskReveal";
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
  /** 第 0 步（章節引子／分隔頁）AI 動畫 URL（優先於 introImageUrl） */
  introAnimationUrl?: string;
  enterAnimationId?: string;
  transitionId?: string;
}) {
  const [introImgOk, setIntroImgOk] = useState(true);

  if (step === 0) {
    const cols = Math.min(Math.max(items.length, 1), 4);
    const showIntroAnim = Boolean(introAnimationUrl?.trim());
    const showIntroImg = !showIntroAnim && Boolean(introImageUrl?.trim()) && introImgOk;
    return (
      <div
        className={`lr-scene scene-pad lr-intro cf-enter-${enterAnimationId}${showIntroAnim || showIntroImg ? " lr-intro--has-figure" : ""}`}
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
        {showIntroAnim ? (
          <MaskReveal show delay={220} duration={900}>
            <div className="lr-intro-visual" data-no-advance>
              <iframe
                className="lr-item-anim"
                src={introAnimationUrl}
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

  // step >= 1: 有配圖／動畫時用 FeaturedCard 全屏置中；否則維持累積格狀揭示
  const activeIdx = step - 1;
  const activeItem = items[activeIdx];
  if (!activeItem) return null;

  const anyItemVisual = items.some((it) => itemHasVisual(it));

  if (anyItemVisual) {
    return (
      <div className="lr-scene scene-pad lr-featured lr-list-reveal" data-cf-transition="none">
        <header className="lr-masthead">
          <span className="lr-rule" />
          <span className="lr-kicker">{kicker ?? chapterTitle}</span>
          <span className="lr-rule" />
        </header>
        <FeaturedCard item={activeItem} />
      </div>
    );
  }

  const cols = Math.min(Math.max(items.length, 1), 4);
  // step >= 1 為同頁累積揭示：勿重跑整頁 cf-enter，僅更新各 slot 狀態與動畫
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

function itemHasVisual(item: ListRevealItem): boolean {
  return Boolean(
    item.imageUrl?.trim() || item.animationHtml?.trim() || item.animationUrl?.trim(),
  );
}

function FeaturedCard({ item }: { item: ListRevealItem }) {
  const [imgOk, setImgOk] = useState(true);
  const hasAnimation = Boolean(item.animationHtml?.trim() || item.animationUrl?.trim());
  // hasVisual 在 render 時就確定，不依賴 imgOk，避免版面閃動
  const hasVisual = hasAnimation || Boolean(item.imageUrl?.trim());
  const showImg = !hasAnimation && Boolean(item.imageUrl?.trim()) && imgOk;

  return (
    <article className={`lr-featured-card${hasVisual ? " lr-featured-card--has-visual" : ""}`}>
      <div className="lr-slot-num hero-num">{item.num}</div>
      <MaskReveal show duration={900}>
        <h2 className="lr-featured-title serif-cn">{item.title}</h2>
      </MaskReveal>
      {hasAnimation ? (
        <MaskReveal show delay={220} duration={900}>
          <div className="lr-featured-visual lr-featured-visual--anim">
            <iframe
              className="lr-featured-anim"
              srcDoc={item.animationHtml || undefined}
              src={item.animationHtml ? undefined : item.animationUrl}
              sandbox="allow-scripts allow-same-origin"
              title={item.title}
              loading="eager"
            />
          </div>
        </MaskReveal>
      ) : showImg ? (
        <MaskReveal show delay={220} duration={900}>
          <div className="lr-featured-visual">
            <img
              className="lr-featured-img"
              src={item.imageUrl}
              alt={item.title}
              loading="eager"
              onError={() => setImgOk(false)}
            />
          </div>
        </MaskReveal>
      ) : null}
      {item.body?.trim() ? (
        <MaskReveal show delay={400} duration={900}>
          <p className="lr-featured-body">{item.body}</p>
        </MaskReveal>
      ) : null}
    </article>
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
  return (
    <div
      className={`lr-slot lr-slot-${state}`}
      style={{ ["--lr-i" as string]: String(index) } as CSSProperties}
    >
      <div className="lr-slot-num hero-num">{item.num}</div>
      <div className="lr-slot-content">
        {state !== "ghost" && (
          <div className="lr-slot-title serif-cn">{item.title}</div>
        )}
      </div>
    </div>
  );
}
