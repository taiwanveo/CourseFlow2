import { motion } from "framer-motion";
import { MaskReveal } from "./MaskReveal";
import "./BeatSceneStep.css";

type BeatHeadlineTone = "hero" | "md" | "lg" | "xl" | "compact";
type BeatAccent = "metric" | "contrast" | "quote" | "default";

const CONTRAST_RE = /對比|对比|差異|相比|另一方面|相對|vs|VS|優於|劣於/i;
const METRIC_RE = /\d+%|百分之|倍|成長|遞增|递减|計數|數字|從\s*0/i;

function beatHeadlineTone(intro: string, introSub: string): BeatHeadlineTone {
  const len = `${intro}${introSub}`.replace(/\s+/g, "").length;
  if (len <= 12) return "hero";
  if (len <= 20) return "md";
  if (len <= 32) return "lg";
  if (len <= 48) return "xl";
  return "compact";
}

function beatAccent(screen: string, narration: string): BeatAccent {
  const blob = `${screen} ${narration}`;
  if (CONTRAST_RE.test(blob)) return "contrast";
  if (METRIC_RE.test(blob)) return "metric";
  if (/強調|關鍵|核心|重點|金句/.test(blob)) return "quote";
  return "default";
}

function metricNumber(screen: string, narration: string): string {
  const blob = `${screen} ${narration}`;
  const m = blob.match(/\d+(?:\.\d+)?%?/);
  return m?.[0] ?? "—";
}

function BeatDecoration({
  accent,
  screen,
  narration,
}: {
  accent: BeatAccent;
  screen: string;
  narration: string;
}) {
  if (accent === "contrast") {
    return (
      <div className="bs-contrast" data-no-advance aria-hidden>
        <motion.span
          className="bs-contrast-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "left center" }}
        />
        <motion.span
          className="bs-contrast-right"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "left center" }}
        />
      </div>
    );
  }
  if (accent === "metric") {
    return (
      <div className="bs-metric" data-no-advance aria-hidden>
        <motion.span
          className="bs-metric-num hero-num"
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {metricNumber(screen, narration)}
        </motion.span>
      </div>
    );
  }
  return (
    <div className="bs-pulse" data-no-advance aria-hidden>
      <motion.span
        className="bs-pulse-ring"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** Beat-Scene：全屏標題 + 內容感知裝飾（對比雙條／大數字／脈衝圓環） */
export function BeatSceneStep({
  kicker,
  headline,
  headlineSub,
  screenText,
  narration,
  imageUrl,
}: {
  kicker: string;
  headline: string;
  headlineSub?: string;
  /** 螢幕原文（供 accent 偵測，不直接顯示） */
  screenText: string;
  narration: string;
  imageUrl?: string;
}) {
  const tone = beatHeadlineTone(headline, headlineSub ?? "");
  const accent = beatAccent(screenText, narration);
  const accentClass =
    accent === "metric"
      ? "bs-accent-metric"
      : accent === "quote"
        ? "bs-accent-quote"
        : accent === "contrast"
          ? "bs-accent-contrast"
          : "bs-accent-default";

  return (
    <div
      className={`bs-scene scene-pad cf-img-text-stack${imageUrl ? " bs-scene--has-figure" : ""}`}
    >
      <div className="bs-main cf-img-text-stack__copy">
        {kicker ? <div className="bs-kicker label-mono">{kicker}</div> : null}
        <h1 className={`bs-headline serif-cn bs-headline--${tone}`}>
          <MaskReveal show duration={1000}>
            <span>{headline}</span>
          </MaskReveal>
          {headlineSub ? (
            <>
              <br />
              <MaskReveal show delay={400} duration={900}>
                <span className={`bs-headline-sub ${accentClass}`}>{headlineSub}</span>
              </MaskReveal>
            </>
          ) : null}
        </h1>
        <BeatDecoration accent={accent} screen={screenText} narration={narration} />
      </div>
      {imageUrl ? (
        <div className="bs-figure-wrap cf-img-text-stack__media cf-img-single" data-no-advance>
          <img
            className="bs-figure"
            src={imageUrl}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
