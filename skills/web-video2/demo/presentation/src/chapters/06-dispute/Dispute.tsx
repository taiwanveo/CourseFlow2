import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Dispute.css";

/* ─────────────────────────────────────────────────────────────────────
 * Chapter 06 · Dispute — 爭議救濟：異議 → 申訴 → 調解仲裁
 *
 *   The dominant metaphor: a three-stage staircase. Steps 1-3 share a
 *   left-rail "ladder" that progressively lights up; the right side
 *   holds the focal card for the active stage. Each step has its own
 *   lead animation (slide-in, count-up, fork-draw, callout reveal).
 * ───────────────────────────────────────────────────────────────────── */

type LadderProps = {
  active: 1 | 2 | 3;
};

/** Vertical 3-stage ladder, used in steps 1-3 as the left rail. */
function Ladder({ active }: LadderProps) {
  const stages = [
    { num: "I", cn: "異議", en: "OBJECTION" },
    { num: "II", cn: "申訴", en: "APPEAL" },
    { num: "III", cn: "調解／仲裁", en: "MEDIATION / ARBITRATION" },
  ];
  return (
    <div className="dp-ladder">
      <svg
        className="dp-ladder-svg"
        viewBox="0 0 80 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* spine */}
        <line
          x1="40"
          y1="20"
          x2="40"
          y2="700"
          stroke="currentColor"
          strokeWidth="1.5"
          className="dp-ladder-spine"
        />
        {/* three nodes */}
        {[60, 360, 660].map((cy, i) => (
          <circle
            key={i}
            cx="40"
            cy={cy}
            r={i + 1 === active ? 14 : 9}
            className={
              "dp-ladder-node" +
              (i + 1 === active ? " is-active" : "") +
              (i + 1 < active ? " is-past" : "")
            }
          />
        ))}
      </svg>
      <ol className="dp-ladder-list">
        {stages.map((s, i) => (
          <li
            key={s.cn}
            className={
              "dp-ladder-item" +
              (i + 1 === active ? " is-active" : "") +
              (i + 1 < active ? " is-past" : "")
            }
          >
            <span className="serif-it dp-ladder-num">{s.num}</span>
            <span className="serif-cn dp-ladder-cn">{s.cn}</span>
            <span className="label-mono dp-ladder-en">{s.en}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Dispute({ step }: ChapterStepProps) {
  /* ───── step 0 — 章節 hero：吵架了，怎麼辦？
     Lead animation: MaskReveal 三段式入場 + 「第六章」mono cue
     右下角三節點靜態縮影預告下一步要看的階梯。 */
  if (step === 0) {
    return (
      <div className="dp-scene scene-pad">
        <div className="dp-h0-corner">
          <span className="label-mono dp-h0-corner-label">第六章</span>
          <span className="serif-it dp-h0-corner-en">Ch. VI</span>
        </div>

        <div className="dp-h0-body">
          <div className="kicker dp-h0-kicker">爭議救濟</div>
          <h1 className="dp-h0-title serif-cn">
            <MaskReveal show duration={750}>
              <span>廠商 </span>
            </MaskReveal>
            <MaskReveal show delay={550} duration={650}>
              <span className="dp-accent serif-it">vs.</span>
            </MaskReveal>
            <MaskReveal show delay={1100} duration={750}>
              <span> 機關</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={1750} duration={850}>
              <span>吵架了，怎麼辦？</span>
            </MaskReveal>
          </h1>

          <div className="dp-h0-foot">
            <div className="dp-h0-foot-line" />
            <div className="serif-cn dp-h0-foot-text">
              第六章設計了一條<span className="dp-accent">三段式</span>救濟。
            </div>
          </div>

          {/* preview chip: three stacked dots = the ladder we're about to climb */}
          <div className="dp-h0-preview" aria-hidden="true">
            <span className="dp-h0-preview-dot dp-h0-preview-dot-1" />
            <span className="dp-h0-preview-rule" />
            <span className="dp-h0-preview-dot dp-h0-preview-dot-2" />
            <span className="dp-h0-preview-rule" />
            <span className="dp-h0-preview-dot dp-h0-preview-dot-3" />
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 第一段「異議」
     Lead animation: ladder spine 從上往下繪製 + 第一節點 pop-in；
     右側卡片 slide-in（書面 / 主辦機關 / 10 日 + 等標期 1/4）。 */
  if (step === 1) {
    return (
      <div className="dp-scene scene-pad">
        <div className="dp-stage-grid">
          <Ladder active={1} />

          <div className="dp-card dp-card-stage1">
            <div className="dp-card-head">
              <span className="serif-it dp-card-roman">I</span>
              <div className="dp-card-head-text">
                <div className="kicker dp-card-kicker">第一段</div>
                <h2 className="dp-card-title serif-cn">異議</h2>
              </div>
              <div className="dp-card-stamp">
                <span className="dp-card-stamp-section">§</span>
                <span className="dp-card-stamp-num">75</span>
              </div>
            </div>

            <div className="dp-card-trigger">
              <span className="label-mono dp-card-trigger-cap">爭議事由</span>
              <div className="serif-cn dp-card-trigger-text">
                招標 ／ 審標 ／ 決標
              </div>
            </div>

            <div className="dp-spec">
              <div className="dp-spec-row dp-spec-row-1">
                <span className="label-mono dp-spec-key">對象</span>
                <span className="serif-cn dp-spec-val">
                  <span className="dp-accent">主辦機關</span>
                </span>
                <span className="label-mono dp-spec-aux">書面提出</span>
              </div>
              <div className="dp-spec-row dp-spec-row-2">
                <span className="label-mono dp-spec-key">期限</span>
                <span className="serif-cn dp-spec-val">
                  <span className="hero-num dp-spec-num">10</span> 日
                </span>
                <span className="label-mono dp-spec-aux">通常情形</span>
              </div>
              <div className="dp-spec-or serif-it">or</div>
              <div className="dp-spec-row dp-spec-row-3">
                <span className="label-mono dp-spec-key">替代</span>
                <span className="serif-cn dp-spec-val">
                  等標期 × <span className="dp-accent">¼</span>
                </span>
                <span className="label-mono dp-spec-aux">取其長者</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 第二段「申訴」
     Lead animation: 階梯走到第二格 (節點 pop + 第一格 dim past)；
     右側 40 / 40 雙塊「審議 + 延長」count-up reveal。 */
  if (step === 2) {
    return (
      <div className="dp-scene scene-pad">
        <div className="dp-stage-grid">
          <Ladder active={2} />

          <div className="dp-card dp-card-stage2">
            <div className="dp-card-head">
              <span className="serif-it dp-card-roman">II</span>
              <div className="dp-card-head-text">
                <div className="kicker dp-card-kicker">第二段</div>
                <h2 className="dp-card-title serif-cn">申訴</h2>
              </div>
              <div className="dp-card-stamp">
                <span className="dp-card-stamp-section">§</span>
                <span className="dp-card-stamp-num">76</span>
              </div>
            </div>

            <div className="dp-card-trigger">
              <span className="label-mono dp-card-trigger-cap">何時申訴</span>
              <div className="serif-cn dp-card-trigger-text">
                對異議結果<span className="dp-accent"> 不服</span>
              </div>
            </div>

            <div className="dp-spec dp-spec-tight">
              <div className="dp-spec-row dp-spec-row-1">
                <span className="label-mono dp-spec-key">對象</span>
                <span className="serif-cn dp-spec-val">
                  <span className="dp-accent">採購申訴審議委員會</span>
                </span>
              </div>
            </div>

            <div className="dp-timeline">
              <div className="dp-tl-block dp-tl-block-base">
                <div className="label-mono dp-tl-block-cap">審議</div>
                <div className="dp-tl-block-num">
                  <span className="hero-num dp-tl-block-figure">40</span>
                  <span className="serif-cn dp-tl-block-unit">日內</span>
                </div>
                <div className="label-mono dp-tl-block-sub">應完成</div>
              </div>
              <div className="dp-tl-plus serif-it">+</div>
              <div className="dp-tl-block dp-tl-block-ext">
                <div className="label-mono dp-tl-block-cap">必要時</div>
                <div className="dp-tl-block-num">
                  <span className="hero-num dp-tl-block-figure">40</span>
                  <span className="serif-cn dp-tl-block-unit">日</span>
                </div>
                <div className="label-mono dp-tl-block-sub">得延長</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 第三段「調解 / 仲裁」分岔
     Lead animation: 第三節點 pop + Y 字分岔 SVG 自繪兩條路徑；
     兩條尾端的「調解」「仲裁」標籤 stagger fade-in。 */
  if (step === 3) {
    return (
      <div className="dp-scene scene-pad">
        <div className="dp-stage-grid">
          <Ladder active={3} />

          <div className="dp-card dp-card-stage3">
            <div className="dp-card-head">
              <span className="serif-it dp-card-roman">III</span>
              <div className="dp-card-head-text">
                <div className="kicker dp-card-kicker">第三段</div>
                <h2 className="dp-card-title serif-cn">調解 ／ 仲裁</h2>
              </div>
              <div className="dp-card-stamp">
                <span className="dp-card-stamp-section">§</span>
                <span className="dp-card-stamp-num dp-card-stamp-num-long">
                  85<span className="dp-card-stamp-dash">-</span>1
                </span>
              </div>
            </div>

            <div className="dp-card-trigger">
              <span className="label-mono dp-card-trigger-cap">何時用</span>
              <div className="serif-cn dp-card-trigger-text">
                <span className="dp-accent">履約</span>爭議談不攏
              </div>
            </div>

            <div className="dp-fork">
              <svg
                className="dp-fork-svg"
                viewBox="0 0 800 300"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* stem */}
                <path
                  d="M 400 20 L 400 130"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="dp-fork-stem"
                />
                {/* left branch — 調解 */}
                <path
                  d="M 400 130 L 140 260"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="dp-fork-left"
                />
                {/* right branch — 仲裁 */}
                <path
                  d="M 400 130 L 660 260"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="dp-fork-right"
                />
                {/* center node */}
                <circle
                  cx="400"
                  cy="130"
                  r="7"
                  fill="currentColor"
                  className="dp-fork-node"
                />
              </svg>

              <div className="dp-fork-labels">
                <div className="dp-fork-label dp-fork-label-left">
                  <span className="label-mono dp-fork-label-ord">A</span>
                  <span className="serif-cn dp-fork-label-cn">申請調解</span>
                  <span className="label-mono dp-fork-label-en">
                    申訴審議委員會
                  </span>
                </div>
                <div className="dp-fork-label dp-fork-label-mid">
                  <span className="serif-it dp-fork-or">or</span>
                </div>
                <div className="dp-fork-label dp-fork-label-right">
                  <span className="label-mono dp-fork-label-ord">B</span>
                  <span className="serif-cn dp-fork-label-cn">提付仲裁</span>
                  <span className="label-mono dp-fork-label-en">
                    仲裁機構
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 4 — 重點 callout：「機關不得拒絕」
     Lead animation: 上方 pull-quote 大字 MaskReveal +
     下方三步流程 chain stagger（工程／技服 → 廠商提付仲裁 → 機關不得拒絕）。 */
  return (
    <div className="dp-scene scene-pad dp-h4-scene">
      <div className="dp-h4-body">
        <div className="dp-h4-tag">
          <span className="label-mono dp-h4-tag-label">廠商 · 重點</span>
          <span className="dp-h4-tag-bar" />
        </div>

        <blockquote className="dp-h4-quote">
          <span className="dp-h4-mark">「</span>
          <span className="serif-cn dp-h4-quote-text">
            機關 <span className="dp-accent">不得拒絕</span>
          </span>
          <span className="dp-h4-mark dp-h4-mark-close">」</span>
        </blockquote>

        <div className="dp-h4-chain">
          <div className="dp-h4-step dp-h4-step-1">
            <div className="label-mono dp-h4-step-ord">01</div>
            <div className="serif-cn dp-h4-step-key">
              工程 ／ 技術服務
            </div>
            <div className="label-mono dp-h4-step-desc">採購類別</div>
          </div>

          <svg
            className="dp-h4-arr dp-h4-arr-1"
            viewBox="0 0 120 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 0 12 L 108 12"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="dp-h4-arr-line"
            />
            <path
              d="M 96 4 L 118 12 L 96 20"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="square"
              className="dp-h4-arr-head"
            />
          </svg>

          <div className="dp-h4-step dp-h4-step-2">
            <div className="label-mono dp-h4-step-ord">02</div>
            <div className="serif-cn dp-h4-step-key">
              廠商<span className="dp-accent">提付仲裁</span>
            </div>
            <div className="label-mono dp-h4-step-desc">主動權在廠商</div>
          </div>

          <svg
            className="dp-h4-arr dp-h4-arr-2"
            viewBox="0 0 120 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 0 12 L 108 12"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="dp-h4-arr-line"
            />
            <path
              d="M 96 4 L 118 12 L 96 20"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="square"
              className="dp-h4-arr-head"
            />
          </svg>

          <div className="dp-h4-step dp-h4-step-3 dp-h4-step-final">
            <div className="label-mono dp-h4-step-ord">03</div>
            <div className="serif-cn dp-h4-step-key">機關不得拒絕</div>
            <div className="label-mono dp-h4-step-desc">§85-1</div>
          </div>
        </div>

        <div className="dp-h4-foot">
          <span className="label-mono">FOR CONSTRUCTION & TECHNICAL SVC.</span>
          <span className="dp-h4-foot-rule" />
          <span className="serif-it dp-h4-foot-en">arbitration not refusable</span>
        </div>
      </div>
    </div>
  );
}
