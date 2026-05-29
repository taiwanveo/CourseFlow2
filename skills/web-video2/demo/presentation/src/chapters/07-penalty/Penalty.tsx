import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Penalty.css";

const MEANS = [
  { ord: "01", word: "強暴" },
  { ord: "02", word: "脅迫" },
  { ord: "03", word: "藥劑" },
  { ord: "04", word: "催眠" },
];

const BLACKLIST_ITEMS = [
  { ord: "i", text: "借牌投標" },
  { ord: "ii", text: "轉包" },
  { ord: "iii", text: "用假文件" },
  { ord: "iv", text: "得標後不簽約" },
];

export default function Penalty({ step }: ChapterStepProps) {
  /* ───── step 0 — hero：「最有牙齒」+ 紅色色塊掃入 ───── */
  if (step === 0) {
    return (
      <div className="pn-scene scene-pad pn-center">
        <div className="pn-hero">
          <div className="pn-hero-mark">
            <span className="pn-hero-mark-bar" />
            <span className="label-mono pn-hero-kicker">CHAPTER · VII · 罰則</span>
          </div>
          <h1 className="pn-hero-h serif-cn">
            <MaskReveal show delay={300} duration={800}>
              <span>罰則這一塊，</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={1000} duration={900}>
              <span className="pn-accent">最有牙齒。</span>
            </MaskReveal>
          </h1>
          <div className="pn-hero-bite" aria-hidden>
            <svg viewBox="0 0 480 32" preserveAspectRatio="none">
              <path
                d="M 0 32 L 20 0 L 40 32 L 60 0 L 80 32 L 100 0 L 120 32 L 140 0 L 160 32 L 180 0 L 200 32 L 220 0 L 240 32 L 260 0 L 280 32 L 300 0 L 320 32 L 340 0 L 360 32 L 380 0 L 400 32 L 420 0 L 440 32 L 460 0 L 480 32 Z"
                fill="currentColor"
                className="pn-hero-bite-path"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 1 — §87 卡：四種手段並列 + 7 年 / 300 萬 hero ───── */
  if (step === 1) {
    return (
      <div className="pn-scene scene-pad">
        <div className="pn-s87-head">
          <div className="pn-s87-stamp">
            <span className="pn-s87-stamp-section">§</span>
            <span className="pn-s87-stamp-num">87</span>
          </div>
          <div className="pn-s87-title-block">
            <div className="kicker pn-s87-kicker">第 87 條 · 最重</div>
            <h2 className="pn-s87-title serif-cn">影響廠商投標的四種手段</h2>
          </div>
        </div>

        <div className="pn-means-row">
          {MEANS.map((m, i) => (
            <div
              key={m.word}
              className="pn-means-cell"
              style={{ ["--i" as string]: i }}
            >
              <div className="label-mono pn-means-ord">{m.ord}</div>
              <div className="pn-means-word serif-cn">{m.word}</div>
              <div className="pn-means-bar" />
            </div>
          ))}
        </div>

        <div className="pn-s87-foot">
          <div className="pn-s87-figure pn-s87-figure-jail">
            <div className="label-mono pn-s87-fig-label">最高有期徒刑</div>
            <div className="pn-s87-fig-value">
              <span className="hero-num pn-s87-fig-num">7</span>
              <span className="pn-s87-fig-unit serif-cn">年</span>
            </div>
          </div>
          <div className="pn-s87-divider" />
          <div className="pn-s87-figure pn-s87-figure-fine">
            <div className="label-mono pn-s87-fig-label">併科罰金 上限</div>
            <div className="pn-s87-fig-value">
              <span className="hero-num pn-s87-fig-num">300</span>
              <span className="pn-s87-fig-unit serif-cn">萬</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 合意圍標補刀：5 年翻牌 + §87 章戳 ───── */
  if (step === 2) {
    return (
      <div className="pn-scene scene-pad pn-center">
        <div className="pn-collude">
          <div className="label-mono pn-collude-kicker">同條 · 合意圍標</div>
          <h2 className="pn-collude-h serif-cn">
            <MaskReveal show duration={700}>
              <span>合意圍標，</span>
            </MaskReveal>
          </h2>
          <div className="pn-collude-hero">
            <span className="pn-collude-prefix serif-cn">最高關</span>
            <span className="pn-collude-num">
              <span className="pn-collude-num-flip">
                <span className="pn-collude-num-old hero-num">7</span>
                <span className="pn-collude-num-new hero-num">5</span>
              </span>
            </span>
            <span className="pn-collude-suffix serif-cn">年。</span>
          </div>
          <div className="pn-collude-note label-mono">
            較 §87 主刑 7 年・降幅 2 年
          </div>
          <div className="pn-collude-stamp">
            <span className="pn-collude-stamp-section">§</span>
            <span className="pn-collude-stamp-num">87</span>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 過場懸念：「比關起來更要命的，是⋯⋯」 ───── */
  if (step === 3) {
    return (
      <div className="pn-scene scene-pad pn-center">
        <div className="pn-tease">
          <div className="pn-tease-line-1 serif-cn">
            <MaskReveal show duration={800}>
              <span>比關起來更要命的，</span>
            </MaskReveal>
          </div>
          <div className="pn-tease-line-2 serif-cn">
            <MaskReveal show delay={900} duration={700}>
              <span>是另一個東西</span>
            </MaskReveal>
            <span className="pn-tease-dots" aria-hidden>
              <span className="pn-tease-dot pn-tease-dot-1">·</span>
              <span className="pn-tease-dot pn-tease-dot-2">·</span>
              <span className="pn-tease-dot pn-tease-dot-3">·</span>
            </span>
          </div>
          <div className="pn-tease-reveal serif-cn">
            <MaskReveal show delay={2800} duration={900}>
              <span className="pn-accent">採購黑名單</span>
            </MaskReveal>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 4 — 採購黑名單大字 + 4 項違規 stagger + §101 ───── */
  if (step === 4) {
    return (
      <div className="pn-scene scene-pad">
        <div className="pn-bl-head">
          <div className="pn-bl-stamp">
            <span className="pn-bl-stamp-section">§</span>
            <span className="pn-bl-stamp-num">101</span>
          </div>
          <div className="pn-bl-title-block">
            <div className="kicker pn-bl-kicker">第 101 條 · 共 15 種情形</div>
            <h2 className="pn-bl-title serif-cn">
              <span className="pn-bl-title-frame">採購黑名單</span>
            </h2>
          </div>
          <div className="pn-bl-count">
            <span className="hero-num pn-bl-count-num">15</span>
            <span className="label-mono pn-bl-count-label">種情形</span>
          </div>
        </div>

        <div className="pn-bl-grid">
          {BLACKLIST_ITEMS.map((item, i) => (
            <div
              key={item.ord}
              className="pn-bl-cell"
              style={{ ["--i" as string]: i }}
            >
              <div className="label-mono pn-bl-cell-ord">{item.ord}</div>
              <div className="pn-bl-cell-text serif-cn">{item.text}</div>
              <div className="pn-bl-cell-cross" aria-hidden>
                <svg viewBox="0 0 64 64">
                  <path
                    d="M 12 12 L 52 52 M 52 12 L 12 52"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="square"
                    className="pn-bl-cell-cross-path"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>

        <div className="pn-bl-foot">
          <span className="label-mono pn-bl-foot-l">中一條</span>
          <span className="pn-bl-foot-arrow serif-it">&rarr;</span>
          <span className="pn-bl-foot-r serif-cn">刊登政府採購公報</span>
        </div>
      </div>
    );
  }

  /* ───── step 5 — §103 禁標期：時間軸 3 月~3 年 + 採購公報 SVG ───── */
  return (
    <div className="pn-scene scene-pad">
      <div className="pn-ban-head">
        <div className="pn-ban-stamp">
          <span className="pn-ban-stamp-section">§</span>
          <span className="pn-ban-stamp-num">103</span>
        </div>
        <div className="pn-ban-title-block">
          <div className="kicker pn-ban-kicker">第 103 條 · 禁標期</div>
          <h2 className="pn-ban-title serif-cn">進了公報，全面禁標。</h2>
        </div>
      </div>

      <div className="pn-ban-body">
        <div className="pn-ban-paper" aria-hidden>
          <svg viewBox="0 0 220 280" preserveAspectRatio="xMidYMid meet">
            <rect
              x="8"
              y="8"
              width="204"
              height="264"
              className="pn-ban-paper-frame"
            />
            <text
              x="110"
              y="50"
              textAnchor="middle"
              fontSize="20"
              fontWeight="700"
              className="pn-ban-paper-masthead"
            >
              政府採購公報
            </text>
            <line x1="20" y1="68" x2="200" y2="68" className="pn-ban-paper-rule" />
            <line x1="20" y1="72" x2="200" y2="72" className="pn-ban-paper-rule" />
            <text x="20" y="98" fontSize="9" className="pn-ban-paper-meta">NOTICE · 2025</text>
            <line x1="20" y1="112" x2="200" y2="112" className="pn-ban-paper-line" />
            <line x1="20" y1="126" x2="180" y2="126" className="pn-ban-paper-line" />
            <line x1="20" y1="140" x2="195" y2="140" className="pn-ban-paper-line" />
            <line x1="20" y1="154" x2="170" y2="154" className="pn-ban-paper-line" />
            <line x1="20" y1="168" x2="190" y2="168" className="pn-ban-paper-line" />
            <line x1="20" y1="182" x2="160" y2="182" className="pn-ban-paper-line" />
            <g className="pn-ban-paper-stamp">
              <rect
                x="60"
                y="200"
                width="100"
                height="48"
                className="pn-ban-paper-stamp-rect"
              />
              <text
                x="110"
                y="232"
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                className="pn-ban-paper-stamp-text"
              >
                禁標
              </text>
            </g>
          </svg>
        </div>

        <div className="pn-ban-timeline">
          <div className="label-mono pn-ban-tl-label">禁標期間 · 依違規情節</div>
          <div className="pn-ban-tl-track">
            <div className="pn-ban-tl-bar" />
            <div className="pn-ban-tl-tick pn-ban-tl-tick-min">
              <span className="pn-ban-tl-tick-mark" />
              <span className="hero-num pn-ban-tl-tick-num">3</span>
              <span className="pn-ban-tl-tick-unit serif-cn">個月</span>
              <span className="label-mono pn-ban-tl-tick-cap">最短</span>
            </div>
            <div className="pn-ban-tl-tick pn-ban-tl-tick-max">
              <span className="pn-ban-tl-tick-mark" />
              <span className="hero-num pn-ban-tl-tick-num">3</span>
              <span className="pn-ban-tl-tick-unit serif-cn">年</span>
              <span className="label-mono pn-ban-tl-tick-cap">最長</span>
            </div>
          </div>
          <div className="pn-ban-tl-foot serif-cn">
            不得參加投標、不得作為決標對象
          </div>
        </div>
      </div>

      <div className="pn-ban-bottom">
        <span className="pn-ban-bottom-text serif-cn">
          對廠商來說，這是<span className="pn-accent">事業層級</span>的打擊。
        </span>
      </div>
    </div>
  );
}
