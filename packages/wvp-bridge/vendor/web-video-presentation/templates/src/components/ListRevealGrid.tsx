import { useState } from "react";
import { MaskReveal } from "./MaskReveal";
import "./ListRevealGrid.css";

export type ListRevealItem = {
  num: string;
  title: string;
  body: string;
  imageUrl?: string;
};

export function ListRevealGrid({
  step,
  chapterTitle,
  introTitle,
  introSub,
  items,
  kicker,
}: {
  step: number;
  chapterTitle: string;
  introTitle: string;
  introSub: string;
  items: ListRevealItem[];
  kicker?: string;
}) {
  if (step === 0) {
    const cols = Math.min(Math.max(items.length, 1), 4);
    return (
      <div className="lr-scene scene-pad lr-intro">
        <header className="lr-masthead">
          <span className="lr-rule" />
          <span className="lr-kicker">{kicker ?? chapterTitle}</span>
          <span className="lr-rule" />
        </header>
        <MaskReveal show duration={1100}>
          <h1 className="lr-intro-h serif-cn">{introTitle}</h1>
        </MaskReveal>
        {introSub ? (
          <MaskReveal show delay={400} duration={900}>
            <div className="lr-intro-sub">{introSub}</div>
          </MaskReveal>
        ) : null}
        <div className="lr-grid lr-grid-ghost" style={{ ["--lr-cols" as string]: String(cols) }}>
          {items.map((it) => (
            <Slot key={it.num} state="ghost" item={it} />
          ))}
        </div>
      </div>
    );
  }

  const activeIdx = step - 1;
  const active = items[activeIdx];
  if (!active) return null;

  return (
    <div className="lr-scene scene-pad lr-featured">
      <header className="lr-masthead">
        <span className="lr-rule" />
        <span className="lr-kicker">{kicker ?? chapterTitle}</span>
        <span className="lr-rule" />
      </header>
      <FeaturedCard item={active} />
    </div>
  );
}

function FeaturedCard({ item }: { item: ListRevealItem }) {
  const [imgOk, setImgOk] = useState(true);
  const showImg = Boolean(item.imageUrl?.trim()) && imgOk;

  return (
    <article className="lr-featured-card">
      <div className="lr-slot-num hero-num">{item.num}</div>
      <MaskReveal show duration={900}>
        <h2 className="lr-featured-title serif-cn">{item.title}</h2>
      </MaskReveal>
      {showImg ? (
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
}: {
  state: "ghost" | "active" | "past";
  item: ListRevealItem;
}) {
  return (
    <div className={`lr-slot lr-slot-${state}`}>
      <div className="lr-slot-num hero-num">{item.num}</div>
      <div className="lr-slot-content">
        {state !== "ghost" && (
          <MaskReveal show duration={900}>
            <div className="lr-slot-title serif-cn">{item.title}</div>
          </MaskReveal>
        )}
      </div>
    </div>
  );
}
