import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./TenderTypes.css";

export default function TenderTypes({ step }: ChapterStepProps) {
  /* ───── step 0 — 章節 hero：三種招標，開放程度遞減 ─────
     Lead animation: title MaskReveal + 三條 openness bars
     生長（從長到短：公開最寬、選擇性中、限制性最窄）。 */
  if (step === 0) {
    return (
      <div className="tt-scene scene-pad">
        <div className="tt-h0-corner">
          <span className="label-mono tt-h0-corner-label">第十八條</span>
          <span className="serif-it tt-h0-corner-sect">§18</span>
        </div>

        <div className="tt-h0-body">
          <div className="kicker tt-h0-kicker">招標 · 三種方式</div>
          <h1 className="tt-h0-title serif-cn">
            <MaskReveal show duration={800}>
              <span>法律把</span>
            </MaskReveal>
            <MaskReveal show delay={500} duration={800}>
              <span className="tt-accent">招標</span>
            </MaskReveal>
            <MaskReveal show delay={1100} duration={800}>
              <span>分成三種，</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={1800} duration={800}>
              <span>按開放程度排。</span>
            </MaskReveal>
          </h1>

          <div className="tt-h0-scale">
            <div className="label-mono tt-h0-scale-cap">
              <span>OPEN</span>
              <span className="tt-h0-scale-arrow">→</span>
              <span>CLOSED</span>
            </div>
            <div className="tt-h0-bars">
              <div className="tt-h0-bar tt-h0-bar-1">
                <div className="tt-h0-bar-fill" />
                <span className="label-mono tt-h0-bar-tag">公開</span>
              </div>
              <div className="tt-h0-bar tt-h0-bar-2">
                <div className="tt-h0-bar-fill" />
                <span className="label-mono tt-h0-bar-tag">選擇性</span>
              </div>
              <div className="tt-h0-bar tt-h0-bar-3">
                <div className="tt-h0-bar-fill" />
                <span className="label-mono tt-h0-bar-tag">限制性</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 公開招標 ─────
     Lead animation: 廠商池（SVG dots）從上方落入廣口漏斗，
     沒有篩選，全數通過。Hero 標號 "I" pop-in。 */
  if (step === 1) {
    return (
      <div className="tt-scene scene-pad">
        <div className="tt-card-head">
          <span className="serif-it tt-card-roman">I</span>
          <div className="tt-card-head-text">
            <div className="kicker tt-card-kicker">第一種</div>
            <h2 className="tt-card-h serif-cn">公開招標</h2>
          </div>
          <span className="badge-mono tt-card-badge is-accent">最透明</span>
        </div>

        <div className="tt-card-body">
          <div className="tt-c1-vis">
            <svg viewBox="0 0 540 360" className="tt-c1-svg" aria-hidden="true">
              {/* dots floating in */}
              {Array.from({ length: 16 }).map((_, i) => {
                const col = i % 8;
                const row = Math.floor(i / 8);
                const cx = 40 + col * 60;
                const cy = 30 + row * 38;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r="7"
                    className="tt-c1-dot"
                    style={{ ["--i" as string]: i }}
                  />
                );
              })}
              {/* wide-mouth funnel */}
              <path
                d="M 30 200 L 510 200 L 360 320 L 180 320 Z"
                className="tt-c1-funnel"
                fill="none"
              />
              <text
                x="270"
                y="350"
                textAnchor="middle"
                className="tt-c1-funnel-label"
              >
                任何廠商都能投
              </text>
            </svg>
          </div>

          <div className="tt-c1-side">
            <div className="tt-c1-arrow">
              <span className="label-mono">機關</span>
              <span className="serif-cn tt-c1-arrow-verb">公告</span>
              <span className="label-mono">不特定廠商</span>
            </div>
            <div className="tt-c1-note serif-cn">
              預設玩法 ——
              <br />
              公告金額以上的案子，
              <br />
              原則上都得走這條。
            </div>
            <div className="label-mono tt-c1-stat">§19 · 原則公開</div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 選擇性招標 ─────
     Lead animation: SVG gate / sieve — dots 從上方落下，
     穿過篩孔，僅部分過關。Plus 兩條 use-case 行 stagger rise。 */
  if (step === 2) {
    return (
      <div className="tt-scene scene-pad">
        <div className="tt-card-head">
          <span className="serif-it tt-card-roman">II</span>
          <div className="tt-card-head-text">
            <div className="kicker tt-card-kicker">第二種</div>
            <h2 className="tt-card-h serif-cn">選擇性招標</h2>
          </div>
          <span className="badge-mono tt-card-badge">先審後投</span>
        </div>

        <div className="tt-card-body">
          <div className="tt-c2-vis">
            <svg viewBox="0 0 540 360" className="tt-c2-svg" aria-hidden="true">
              {/* incoming dots — many */}
              {Array.from({ length: 9 }).map((_, i) => (
                <circle
                  key={`in-${i}`}
                  cx={60 + i * 52}
                  cy={40}
                  r="7"
                  className="tt-c2-dot-in"
                  style={{ ["--i" as string]: i }}
                />
              ))}
              {/* sieve / gate */}
              <line
                x1="20"
                y1="170"
                x2="520"
                y2="170"
                className="tt-c2-sieve"
              />
              {/* sieve hole markers */}
              {[112, 268, 424].map((x, i) => (
                <circle
                  key={`hole-${i}`}
                  cx={x}
                  cy={170}
                  r="14"
                  fill="none"
                  className="tt-c2-hole"
                  style={{ ["--i" as string]: i }}
                />
              ))}
              <text
                x="20"
                y="200"
                className="tt-c2-sieve-label"
              >
                資格審查
              </text>
              {/* qualified dots passing through */}
              {[112, 268, 424].map((x, i) => (
                <circle
                  key={`out-${i}`}
                  cx={x}
                  cy={300}
                  r="9"
                  className="tt-c2-dot-out"
                  style={{ ["--i" as string]: i }}
                />
              ))}
            </svg>
          </div>

          <div className="tt-c2-side">
            <div className="tt-c2-flow">
              <span className="serif-cn tt-c2-flow-step">先公告</span>
              <span className="tt-c2-flow-sep">／</span>
              <span className="serif-cn tt-c2-flow-step">審資格</span>
              <span className="tt-c2-flow-sep">／</span>
              <span className="serif-cn tt-c2-flow-step tt-accent">過關才投</span>
            </div>

            <div className="label-mono tt-c2-cases-cap">適用情境</div>
            <ul className="tt-c2-cases">
              <li className="tt-c2-case tt-c2-case-1">
                <span className="serif-it tt-c2-case-num">i.</span>
                <span className="serif-cn tt-c2-case-text">經常性採購</span>
              </li>
              <li className="tt-c2-case tt-c2-case-2">
                <span className="serif-it tt-c2-case-num">ii.</span>
                <span className="serif-cn tt-c2-case-text">需特殊技術設備</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 限制性招標 ─────
     Lead animation: 兩種模式 overshoot scale-in —
     左邊「比價」≥2 個 dot pair，右邊「議價」單一 dot。 */
  if (step === 3) {
    return (
      <div className="tt-scene scene-pad">
        <div className="tt-card-head">
          <span className="serif-it tt-card-roman">III</span>
          <div className="tt-card-head-text">
            <div className="kicker tt-card-kicker">第三種</div>
            <h2 className="tt-card-h serif-cn">限制性招標</h2>
          </div>
          <span className="badge-mono tt-card-badge">不公告</span>
        </div>

        <div className="tt-card-body">
          <div className="tt-c3-modes">
            <div className="tt-c3-mode tt-c3-mode-bid">
              <div className="label-mono tt-c3-mode-cap">模式 A</div>
              <div className="tt-c3-mode-dots">
                <span className="tt-c3-dot tt-c3-dot-1" />
                <span className="tt-c3-dot tt-c3-dot-2" />
                <span className="tt-c3-dot tt-c3-dot-3" />
                <span className="tt-c3-dot tt-c3-dot-4" />
              </div>
              <div className="tt-c3-mode-title serif-cn">比價</div>
              <div className="tt-c3-mode-desc">
                邀請<span className="tt-accent"> ≥ 2 </span>家廠商
              </div>
            </div>

            <div className="tt-c3-divider">
              <span className="serif-cn tt-c3-or">or</span>
            </div>

            <div className="tt-c3-mode tt-c3-mode-nego">
              <div className="label-mono tt-c3-mode-cap">模式 B</div>
              <div className="tt-c3-mode-dots tt-c3-mode-dots-single">
                <span className="tt-c3-dot tt-c3-dot-solo" />
              </div>
              <div className="tt-c3-mode-title serif-cn">議價</div>
              <div className="tt-c3-mode-desc">
                僅邀請<span className="tt-accent"> 1 </span>家
              </div>
            </div>
          </div>

          <div className="tt-c3-foot">
            <hr className="rule tt-c3-foot-rule" />
            <div className="serif-cn tt-c3-foot-text">
              不公告，由機關自己選對象。
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 4 — 轉折提醒 ─────
     Lead animation: pull-quote 大字 slide-from-right + 紅色
     左邊條 vertical scale-down，配 cinematic 留白。 */
  if (step === 4) {
    return (
      <div className="tt-scene scene-pad tt-center">
        <div className="tt-pivot">
          <div className="kicker tt-pivot-kicker">但是 ——</div>
          <blockquote className="tt-pivot-quote">
            <span className="tt-pivot-mark">「</span>
            <span className="serif-cn tt-pivot-text">
              我就想找<span className="tt-accent">這家</span>
            </span>
            <span className="tt-pivot-mark tt-pivot-mark-close">」</span>
          </blockquote>
          <div className="tt-pivot-foot">
            <span className="serif-cn tt-pivot-foot-text">
              機關不能這樣就走限制性招標。
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 5 — §22 三項條件 ─────
     Lead animation: numbered list 三項 stagger rise，每項
     底下 hairline rule scaleX 拉開。 */
  if (step === 5) {
    const conditions = [
      { num: "i.", text: "獨家供應", hint: "唯一供應或替代" },
      { num: "ii.", text: "緊急採購", hint: "情況急迫不及公開" },
      { num: "iii.", text: "藝文採購", hint: "性質特殊" },
    ];
    return (
      <div className="tt-scene scene-pad">
        <div className="tt-c5-head">
          <div className="tt-c5-section">
            <span className="serif-it tt-c5-sect">§</span>
            <span className="hero-num tt-c5-sect-num">22</span>
          </div>
          <div className="tt-c5-head-text">
            <div className="kicker tt-c5-kicker">第 22 條 · 列舉</div>
            <h2 className="tt-c5-h serif-cn">這些才能走限制性</h2>
          </div>
        </div>

        <ol className="tt-c5-list">
          {conditions.map((c, i) => (
            <li
              key={c.text}
              className={`tt-c5-item tt-c5-item-${i + 1}`}
              style={{ ["--i" as string]: i }}
            >
              <span className="serif-it tt-c5-item-num">{c.num}</span>
              <div className="tt-c5-item-body">
                <span className="serif-cn tt-c5-item-text">{c.text}</span>
                <span className="label-mono tt-c5-item-hint">{c.hint}</span>
              </div>
              <span className="tt-c5-item-rule" />
            </li>
          ))}
        </ol>
      </div>
    );
  }

  /* ───── step 6 — §41 + §48 雙列補充 ─────
     Lead animation: 兩張卡片從左右兩側 slide-in，
     右卡內部 hero-num "3" scale + 三個 dot 依次點亮。 */
  return (
    <div className="tt-scene scene-pad">
      <div className="tt-c6-head">
        <div className="kicker tt-c6-kicker">補充規則</div>
        <div className="tt-c6-title serif-cn">另外兩條別忘了</div>
      </div>

      <div className="tt-c6-grid">
        <div className="tt-c6-card tt-c6-card-left">
          <div className="tt-c6-card-section">
            <span className="serif-it tt-c6-card-sect">§</span>
            <span className="hero-num tt-c6-card-sect-num">41</span>
          </div>
          <div className="label-mono tt-c6-card-cap">廠商 · 權利</div>
          <h3 className="tt-c6-card-h serif-cn">可請釋疑</h3>
          <p className="tt-c6-card-p">
            廠商對招標文件有疑問，<br />
            能正式請機關
            <span className="tt-accent">「釋疑」</span>。
          </p>
        </div>

        <div className="tt-c6-card tt-c6-card-right">
          <div className="tt-c6-card-section">
            <span className="serif-it tt-c6-card-sect">§</span>
            <span className="hero-num tt-c6-card-sect-num">48</span>
          </div>
          <div className="label-mono tt-c6-card-cap">開標 · 門檻</div>
          <h3 className="tt-c6-card-h serif-cn">三家以上才能開</h3>
          <div className="tt-c6-count">
            <span className="tt-c6-count-dot tt-c6-count-dot-1" />
            <span className="tt-c6-count-dot tt-c6-count-dot-2" />
            <span className="tt-c6-count-dot tt-c6-count-dot-3" />
            <span className="serif-cn tt-c6-count-plus">+</span>
          </div>
          <p className="tt-c6-card-p">
            三家以上<span className="tt-accent">合格</span>廠商投標，
            <br />
            才能開標、才能決標。
          </p>
        </div>
      </div>
    </div>
  );
}
