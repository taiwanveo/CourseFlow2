import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Payment.css";

export default function Payment({ step }: ChapterStepProps) {
  /* ───── step 0 — 履約流程線：履約完成 → 驗收（§71） → 請款 ───── */
  if (step === 0) {
    return (
      <div className="pm-scene scene-pad">
        <div className="pm-flow-head">
          <div className="kicker pm-flow-kicker">第 5 章 · 驗收與付款</div>
          <h2 className="pm-flow-title serif-cn">
            <MaskReveal show duration={800}>
              <span>工程做完了，要驗收。</span>
            </MaskReveal>
          </h2>
        </div>

        <div className="pm-flow-stage">
          <svg
            className="pm-flow-svg"
            viewBox="0 0 1600 240"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            {/* 主流程連線 —— 兩段，分別在節點之間繪製 */}
            <line
              className="pm-flow-line pm-flow-line-1"
              x1="240"
              y1="120"
              x2="800"
              y2="120"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              className="pm-flow-line pm-flow-line-2"
              x1="800"
              y1="120"
              x2="1360"
              y2="120"
              stroke="currentColor"
              strokeWidth="2"
            />

            {/* 三個節點 ring + dot */}
            <g className="pm-flow-node pm-flow-node-1">
              <circle
                cx="240"
                cy="120"
                r="36"
                fill="var(--surface)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="240" cy="120" r="10" fill="currentColor" />
            </g>
            <g className="pm-flow-node pm-flow-node-2">
              <circle
                cx="800"
                cy="120"
                r="36"
                fill="var(--surface)"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              <circle cx="800" cy="120" r="10" fill="var(--accent)" />
            </g>
            <g className="pm-flow-node pm-flow-node-3">
              <circle
                cx="1360"
                cy="120"
                r="36"
                fill="var(--surface)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="1360" cy="120" r="10" fill="currentColor" />
            </g>
          </svg>

          {/* 節點標籤 —— 用 HTML 疊在 SVG 之上以利字型一致 */}
          <div className="pm-flow-labels">
            <div className="pm-flow-label pm-flow-label-1">
              <div className="label-mono pm-flow-stage-tag">STAGE 01</div>
              <div className="pm-flow-label-h serif-cn">履約完成</div>
              <div className="pm-flow-label-sub">工程交付</div>
            </div>
            <div className="pm-flow-label pm-flow-label-2">
              <div className="label-mono pm-flow-stage-tag pm-flow-stage-tag-accent">
                §71
              </div>
              <div className="pm-flow-label-h serif-cn">驗收</div>
              <div className="pm-flow-label-sub">機關確認合格</div>
            </div>
            <div className="pm-flow-label pm-flow-label-3">
              <div className="label-mono pm-flow-stage-tag">STAGE 03</div>
              <div className="pm-flow-label-h serif-cn">請款</div>
              <div className="pm-flow-label-sub">廠商遞送單據</div>
            </div>
          </div>
        </div>

        <div className="pm-flow-coda serif-cn">
          <MaskReveal show delay={2200} duration={800}>
            <span>驗收合格 — 廠商當然要拿錢。</span>
          </MaskReveal>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 高亮條文「§73-1」大字 + 副標 ───── */
  if (step === 1) {
    return (
      <div className="pm-scene scene-pad pm-center">
        <div className="pm-clause">
          <div className="kicker pm-clause-kicker">關鍵條文</div>

          <div className="pm-clause-hero">
            <span className="hero-num pm-clause-section">§</span>
            <span className="hero-num pm-clause-num">73</span>
            <span className="hero-num pm-clause-dash">—</span>
            <span className="hero-num pm-clause-suffix">1</span>
          </div>

          <hr className="rule pm-clause-rule" />

          <div className="pm-clause-body">
            <div className="label-mono pm-clause-side">CONDITION</div>
            <h2 className="pm-clause-h serif-cn">
              <MaskReveal show delay={500} duration={900}>
                <span>機關收到</span>
              </MaskReveal>
              <MaskReveal show delay={1100} duration={900}>
                <span className="pm-accent">請款單據</span>
              </MaskReveal>
              <MaskReveal show delay={1700} duration={900}>
                <span>後 ——</span>
              </MaskReveal>
            </h2>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — hero 數字「15」+ 周邊 metadata ───── */
  if (step === 2) {
    return (
      <div className="pm-scene scene-pad">
        <div className="pm-day-grid">
          <div className="pm-day-left">
            <div className="label-mono pm-day-label">DEADLINE</div>
            <div className="pm-day-prefix serif-cn">內</div>
            <div className="pm-day-prefix-sub">付款</div>
          </div>

          <div className="pm-day-hero">
            <span className="hero-num pm-day-num">15</span>
            <div className="pm-day-meta">
              <div className="pm-day-unit serif-cn">個工作日</div>
              <div className="pm-day-fineprint label-mono">
                不含例假日
              </div>
            </div>
          </div>

          <div className="pm-day-right">
            <div className="pm-day-rail" />
            <div className="label-mono pm-day-source">§73-1</div>
          </div>
        </div>

        <div className="pm-day-foot">
          <div className="pm-day-foot-bar" />
          <div className="pm-day-foot-text serif-cn">
            自機關收到請款單據翌日起算
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 對比並列：儘速 / 儘量 / 法定期限 ───── */
  return (
    <div className="pm-scene scene-pad">
      <div className="pm-cmp-head">
        <div className="kicker pm-cmp-kicker">對廠商而言</div>
        <h2 className="pm-cmp-title serif-cn">
          <MaskReveal show duration={700}>
            <span>不是模糊承諾，是 ——</span>
          </MaskReveal>
        </h2>
      </div>

      <div className="pm-cmp-grid">
        <div className="pm-cmp-card pm-cmp-card-bad pm-cmp-card-1">
          <div className="label-mono pm-cmp-tag">口頭話術</div>
          <div className="pm-cmp-word-wrap">
            <span className="pm-cmp-word serif-cn">儘速</span>
            <span className="pm-cmp-strike" aria-hidden />
          </div>
          <div className="pm-cmp-mark pm-cmp-mark-bad" aria-hidden>
            <svg viewBox="0 0 48 48" width="48" height="48">
              <path
                d="M 12 12 L 36 36 M 36 12 L 12 36"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              />
            </svg>
          </div>
          <div className="pm-cmp-foot">無時限</div>
        </div>

        <div className="pm-cmp-card pm-cmp-card-bad pm-cmp-card-2">
          <div className="label-mono pm-cmp-tag">口頭話術</div>
          <div className="pm-cmp-word-wrap">
            <span className="pm-cmp-word serif-cn">儘量</span>
            <span className="pm-cmp-strike" aria-hidden />
          </div>
          <div className="pm-cmp-mark pm-cmp-mark-bad" aria-hidden>
            <svg viewBox="0 0 48 48" width="48" height="48">
              <path
                d="M 12 12 L 36 36 M 36 12 L 12 36"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              />
            </svg>
          </div>
          <div className="pm-cmp-foot">無剛性</div>
        </div>

        <div className="pm-cmp-card pm-cmp-card-good pm-cmp-card-3">
          <div className="label-mono pm-cmp-tag pm-cmp-tag-accent">
            §73-1 · 法源
          </div>
          <div className="pm-cmp-word-wrap">
            <span className="pm-cmp-word pm-cmp-word-good serif-cn">
              法定期限
            </span>
          </div>
          <div className="pm-cmp-mark pm-cmp-mark-good" aria-hidden>
            <svg viewBox="0 0 48 48" width="48" height="48">
              <path
                d="M 10 26 L 22 36 L 40 14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
                fill="none"
              />
            </svg>
          </div>
          <div className="pm-cmp-foot pm-cmp-foot-accent">
            15 個工作日 · 可索引
          </div>
        </div>
      </div>

      <div className="pm-cmp-coda">
        <div className="pm-cmp-coda-bar" />
        <div className="pm-cmp-coda-text serif-cn">
          廠商有了能拿出來講的依據
        </div>
      </div>
    </div>
  );
}
