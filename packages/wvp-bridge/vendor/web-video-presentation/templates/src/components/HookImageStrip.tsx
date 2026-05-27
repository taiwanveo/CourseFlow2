import { MaskReveal } from "./MaskReveal";
import "./HookImageStrip.css";

export type HookSlide = {
  url: string | null;
  alt: string;
  caption: string;
  label: string;
};

function SoloImage({ slide }: { slide: HookSlide }) {
  if (slide.url) {
    return <img className="hk-solo-img" src={slide.url} alt={slide.alt} />;
  }
  return (
    <div className="hk-placeholder" aria-hidden>
      <span className="hk-placeholder-label">image · 16:9</span>
      <span className="hk-placeholder-cap">{slide.alt}</span>
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
}: {
  step: number;
  chapterTitle: string;
  introKicker: string;
  slides: HookSlide[];
  takeoverTitle: string;
  closeLine?: string;
  includeClose: boolean;
}) {
  const n = slides.length;
  const takeoverStep = 1 + n;
  const closeStep = includeClose ? takeoverStep + 1 : -1;

  if (step === 0) {
    return (
      <div className="hk-scene scene-pad">
        <div className="hk-kicker">
          <span className="hk-kicker-line" />
          <span className="hk-kicker-text">{introKicker || chapterTitle}</span>
        </div>
        <div className="hk-grid">
          {slides.map((s, idx) => (
            <MaskReveal show key={s.label} delay={idx * 200} duration={900}>
              <div className="hk-ghost">
                <span className="hk-ghost-num">{s.label.split("/")[0]?.trim() || String(idx + 1)}</span>
                <span className="hk-ghost-label">{s.url ? "ready" : "image"}</span>
              </div>
            </MaskReveal>
          ))}
        </div>
      </div>
    );
  }

  if (step >= 1 && step <= n) {
    const s = slides[step - 1]!;
    return (
      <div className="hk-scene scene-pad">
        <div className="hk-solo-frame">
          <MaskReveal show duration={1100}>
            <div className="hk-solo-img-wrap">
              <SoloImage slide={s} />
              <div className="hk-stamp">重點</div>
            </div>
          </MaskReveal>
          <MaskReveal show delay={400} duration={900}>
            <div className="hk-solo-meta">
              <span className="hk-solo-label">{s.label}</span>
              <span className="hk-solo-caption serif-cn">{s.caption}</span>
            </div>
          </MaskReveal>
        </div>
      </div>
    );
  }

  if (step === takeoverStep) {
    return (
      <div className="hk-scene scene-pad hk-takeover">
        <div className="hk-mini-row">
          {slides.map((s, idx) =>
            s.url ? (
              <img
                key={s.label}
                className="hk-mini"
                src={s.url}
                alt={s.alt}
                style={{ animationDelay: `${idx * 80}ms` }}
              />
            ) : (
              <div key={s.label} className="hk-mini hk-mini-ph" />
            ),
          )}
        </div>
        <span className="hk-accent-bar" />
        <h1 className="hk-hero">
          <MaskReveal show duration={1100}>
            <span className="serif-cn">{takeoverTitle}</span>
          </MaskReveal>
        </h1>
      </div>
    );
  }

  if (includeClose && step === closeStep && closeLine) {
    return (
      <div className="hk-scene scene-pad hk-close">
        <div className="hk-quote-wrap">
          <h2 className="hk-quote serif-cn">{closeLine}</h2>
          <span className="hk-brush" aria-hidden />
        </div>
      </div>
    );
  }

  return null;
}
