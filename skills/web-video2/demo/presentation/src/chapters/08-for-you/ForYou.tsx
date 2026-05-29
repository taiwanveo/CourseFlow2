import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./ForYou.css";

export default function ForYou({ step }: ChapterStepProps) {
  /* ───── step 0 — 反轉句：不是給公務員念的工具書 ─────
     Lead animation: 灰色「工具書」placeholder + 紅筆對角劃掉 (SVG path
     draw)。MaskReveal 揭示主標。「不是」用 accent + scale 強調。 */
  if (step === 0) {
    return (
      <div className="fy-scene scene-pad">
        <div className="fy-flip-head">
          <div className="kicker fy-flip-kicker">CHAPTER 8 · 對你的意義</div>
        </div>

        <div className="fy-flip-body">
          <div className="fy-flip-manual" aria-hidden>
            <div className="label-mono fy-flip-manual-tag">公務員手冊</div>
            <div className="fy-flip-manual-lines">
              <span className="fy-flip-manual-line fy-flip-manual-line-1" />
              <span className="fy-flip-manual-line fy-flip-manual-line-2" />
              <span className="fy-flip-manual-line fy-flip-manual-line-3" />
              <span className="fy-flip-manual-line fy-flip-manual-line-4" />
            </div>
            <svg
              className="fy-flip-strike"
              viewBox="0 0 320 220"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M 20 30 L 300 195"
                className="fy-flip-strike-1"
                stroke="var(--accent)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="square"
              />
              <path
                d="M 300 30 L 20 195"
                className="fy-flip-strike-2"
                stroke="var(--accent)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="square"
              />
            </svg>
          </div>

          <h1 className="fy-flip-h serif-cn">
            <MaskReveal show duration={700}>
              <span>這部法律</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={700} duration={800}>
              <span className="fy-strike-text">不是</span>
            </MaskReveal>
            <MaskReveal show delay={1300} duration={800}>
              <span>給公務員念的</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={1900} duration={800}>
              <span className="fy-flip-mute">工具書。</span>
            </MaskReveal>
          </h1>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 大字 hero：你的稅金 ─────
     Lead animation: 破折號從中心拉出 (scaleX) → 「你的稅金」scale-in
     + 紅色底線從左到右生長。pull-quote 氣質。 */
  if (step === 1) {
    return (
      <div className="fy-scene scene-pad fy-center">
        <div className="fy-q-body">
          <div className="kicker fy-q-kicker">它管的是 ——</div>

          <div className="fy-q-dash" aria-hidden>
            <span className="fy-q-dash-line" />
          </div>

          <h2 className="fy-q-h serif-cn">
            <span className="fy-q-h-line">你的</span>
            <span className="fy-q-h-line fy-q-h-accent">稅金</span>
            <span className="fy-q-h-line fy-q-h-mute">，</span>
            <br />
            <span className="fy-q-h-line fy-q-h-mute">要花到誰手上。</span>
          </h2>

          <div className="fy-q-underline" />
        </div>
      </div>
    );
  }

  /* ───── step 2 — 三場景卡片陣列 + 上方「114 條規矩盯著」標籤 ─────
     Lead animation: 上方標籤 fade-in → 三張卡片 stagger rise，每張卡
     的 SVG icon 也有 stroke draw。場景：捷運鐵軌 / 餐盤 / 建築。 */
  if (step === 2) {
    return (
      <div className="fy-scene scene-pad">
        <div className="fy-grid-head">
          <div className="fy-grid-watch">
            <svg
              className="fy-watch-svg"
              viewBox="0 0 64 32"
              aria-hidden
            >
              <ellipse
                cx="32"
                cy="16"
                rx="26"
                ry="11"
                stroke="var(--accent)"
                strokeWidth="2"
                fill="none"
                className="fy-watch-eye"
              />
              <circle
                cx="32"
                cy="16"
                r="5"
                fill="var(--accent)"
                className="fy-watch-pupil"
              />
            </svg>
            <div className="fy-watch-text">
              <span className="label-mono fy-grid-tag">監看 · 全部</span>
              <span className="serif-cn fy-grid-stat">
                <span className="hero-num fy-grid-num">114</span>
                <span className="fy-grid-stat-unit">條規矩盯著</span>
              </span>
            </div>
          </div>
        </div>

        <div className="fy-grid">
          <article className="fy-card fy-card-1">
            <div className="label-mono fy-card-no">SCENE · 01</div>
            <div className="fy-card-icon" aria-hidden>
              <svg viewBox="0 0 240 140" className="fy-icon-svg">
                <line
                  x1="20"
                  y1="50"
                  x2="220"
                  y2="50"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-rail-line fy-icon-rail-line-1"
                />
                <line
                  x1="20"
                  y1="92"
                  x2="220"
                  y2="92"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-rail-line fy-icon-rail-line-2"
                />
                {Array.from({ length: 9 }).map((_, i) => (
                  <line
                    key={i}
                    x1={36 + i * 24}
                    y1="40"
                    x2={36 + i * 24}
                    y2="102"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="fy-icon-rail-tie"
                    style={{ ["--i" as string]: i }}
                  />
                ))}
              </svg>
            </div>
            <h3 className="fy-card-h serif-cn">捷運</h3>
            <p className="fy-card-sub">誰來蓋</p>
          </article>

          <article className="fy-card fy-card-2">
            <div className="label-mono fy-card-no">SCENE · 02</div>
            <div className="fy-card-icon" aria-hidden>
              <svg viewBox="0 0 240 140" className="fy-icon-svg">
                <ellipse
                  cx="120"
                  cy="92"
                  rx="84"
                  ry="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="fy-icon-plate-rim"
                />
                <ellipse
                  cx="120"
                  cy="88"
                  rx="64"
                  ry="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="fy-icon-plate-inner"
                />
                <line
                  x1="68"
                  y1="60"
                  x2="68"
                  y2="84"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-utensil fy-icon-utensil-1"
                />
                <line
                  x1="58"
                  y1="60"
                  x2="58"
                  y2="74"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-utensil fy-icon-utensil-2"
                />
                <line
                  x1="78"
                  y1="60"
                  x2="78"
                  y2="74"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-utensil fy-icon-utensil-3"
                />
                <line
                  x1="172"
                  y1="56"
                  x2="172"
                  y2="84"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-utensil fy-icon-utensil-4"
                />
                <ellipse
                  cx="172"
                  cy="60"
                  rx="6"
                  ry="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="fy-icon-utensil fy-icon-utensil-5"
                />
              </svg>
            </div>
            <h3 className="fy-card-h serif-cn">營養午餐</h3>
            <p className="fy-card-sub">誰來供應</p>
          </article>

          <article className="fy-card fy-card-3">
            <div className="label-mono fy-card-no">SCENE · 03</div>
            <div className="fy-card-icon" aria-hidden>
              <svg viewBox="0 0 240 140" className="fy-icon-svg">
                <line
                  x1="40"
                  y1="120"
                  x2="200"
                  y2="120"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-bld-base"
                />
                <rect
                  x="60"
                  y="32"
                  width="120"
                  height="88"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="fy-icon-bld-outline"
                />
                <line
                  x1="120"
                  y1="32"
                  x2="120"
                  y2="120"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="fy-icon-bld-spine"
                />
                {Array.from({ length: 4 }).map((_, i) => (
                  <g key={i} className="fy-icon-bld-win-row" style={{ ["--i" as string]: i }}>
                    <rect
                      x="74"
                      y={44 + i * 20}
                      width="16"
                      height="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <rect
                      x="98"
                      y={44 + i * 20}
                      width="16"
                      height="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <rect
                      x="126"
                      y={44 + i * 20}
                      width="16"
                      height="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <rect
                      x="150"
                      y={44 + i * 20}
                      width="16"
                      height="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </g>
                ))}
              </svg>
            </div>
            <h3 className="fy-card-h serif-cn">市政府電腦</h3>
            <p className="fy-card-sub">買哪一家</p>
          </article>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 收尾三詞 hero + 結語小字 ─────
     Lead animation: 三詞「公平・公開・可救濟」從中心鏡頭推出 (scale +
     fade)，每個詞之間有點 (·) 描繪。下方分隔線生長 → coda 慢速 fade。
     氣質：莊重、慢、有電影感終幕。 */
  return (
    <div className="fy-scene scene-pad fy-center">
      <div className="fy-coda">
        <div className="kicker fy-coda-kicker">理解這幾個字</div>

        <div className="fy-coda-triplet">
          <span className="fy-coda-word fy-coda-word-1 serif-cn">公平</span>
          <span className="fy-coda-sep fy-coda-sep-1" aria-hidden>·</span>
          <span className="fy-coda-word fy-coda-word-2 serif-cn">公開</span>
          <span className="fy-coda-sep fy-coda-sep-2" aria-hidden>·</span>
          <span className="fy-coda-word fy-coda-word-3 serif-cn">可救濟</span>
        </div>

        <div className="fy-coda-rule" />

        <div className="fy-coda-tail">
          <p className="fy-coda-line fy-coda-line-1 serif-cn">
            就是理解一個現代社會
          </p>
          <p className="fy-coda-line fy-coda-line-2">
            怎麼用<span className="fy-coda-em">透明的程序</span>，處理大家共同的錢。
          </p>
        </div>

        <div className="fy-coda-end" aria-hidden>
          <span className="fy-coda-end-mark serif-it">— fin</span>
        </div>
      </div>
    </div>
  );
}
