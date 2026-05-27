import { MaskReveal } from "./MaskReveal";
import "./NarrationBeat.css";

/**
 * 口播逐句揭示 — 畫面上的文字即本章口播原文，動效為依序 wipe-in。
 * 禁止假圖表／無關關鍵詞；與 CHAPTER-CRAFT「內容即視覺」對齊。
 */
const hideNarrationOnScreen =
  import.meta.env.VITE_CF_HIDE_NARRATION === "true" ||
  import.meta.env.VITE_CF_HIDE_NARRATION === "1";

/** 口播僅供音訊／錄製；CourseFlow 預設不在畫面上重複顯示口播全文 */
export function NarrationBeat({
  phrases,
  className,
}: {
  phrases: string[];
  className?: string;
}) {
  if (hideNarrationOnScreen) return null;
  const lines = phrases.filter((p) => p.trim().length > 0);
  if (lines.length === 0) return null;

  return (
    <div
      className={["cf-narration-beat", className].filter(Boolean).join(" ")}
      data-no-advance
      aria-hidden
    >
      {lines.map((line, i) => (
        <p key={i} className="cf-narration-beat-line" style={{ ["--i" as string]: String(i) }}>
          <MaskReveal show delay={180 + i * 320} duration={900}>
            <span className="serif-cn">{line}</span>
          </MaskReveal>
        </p>
      ))}
    </div>
  );
}
