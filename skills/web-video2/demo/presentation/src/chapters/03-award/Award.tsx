import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Award.css";

export default function Award({ step }: ChapterStepProps) {
  /* ───── step 0 — hero 提問 + §52 兩條路 ───── */
  if (step === 0) {
    return (
      <div className="aw-scene scene-pad">
        <div className="aw-hero-body">
          <div className="kicker aw-hero-kicker">第 3 章 · 決標</div>

          <h1 className="aw-hero-h serif-cn">
            <MaskReveal show duration={750}>
              <span>招標完了，</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={650} duration={800}>
              <span>怎麼決</span>
            </MaskReveal>
            <MaskReveal show delay={1300} duration={750}>
              <span className="aw-accent">誰得標</span>
            </MaskReveal>
            <MaskReveal show delay={1900} duration={650}>
              <span>？</span>
            </MaskReveal>
          </h1>

          <div className="aw-hero-foot">
            <div className="aw-hero-cue">
              <span className="label-mono aw-hero-cue-label">第 52 條</span>
              <span className="aw-hero-cue-rule" />
              <span className="serif-it aw-hero-cue-en">two routes</span>
            </div>

            {/* fork SVG: a single line splits into two routes */}
            <svg
              className="aw-fork"
              viewBox="0 0 480 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 0 40 L 200 40"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="aw-fork-stem"
              />
              <path
                d="M 200 40 L 480 8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="aw-fork-up"
              />
              <path
                d="M 200 40 L 480 72"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="aw-fork-down"
              />
              <circle
                cx="200"
                cy="40"
                r="5"
                fill="currentColor"
                className="aw-fork-node"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 最低標：標題 + 三要點 stagger ───── */
  if (step === 1) {
    return (
      <div className="aw-scene scene-pad">
        <div className="aw-route-head">
          <div className="kicker aw-route-ord">路 · 01 · 第 52 條</div>
          <h2 className="aw-route-title serif-cn">
            <span className="aw-route-num serif-it">I.</span>
            <span>最低標</span>
          </h2>
          <div className="aw-route-sub serif-cn">
            合於規定者裡，<span className="aw-accent">標價最低</span>者得標
          </div>
        </div>

        <div className="aw-pts">
          <div className="aw-pt aw-pt-1">
            <div className="label-mono aw-pt-ord">01</div>
            <div className="aw-pt-key serif-cn">合於規定</div>
            <div className="aw-pt-desc">先過招標文件門檻</div>
          </div>
          <div className="aw-pt-divider aw-pt-divider-1" />
          <div className="aw-pt aw-pt-2">
            <div className="label-mono aw-pt-ord">02</div>
            <div className="aw-pt-key serif-cn">標價最低</div>
            <div className="aw-pt-desc">純比價，數字說話</div>
          </div>
          <div className="aw-pt-divider aw-pt-divider-2" />
          <div className="aw-pt aw-pt-3">
            <div className="label-mono aw-pt-ord">03</div>
            <div className="aw-pt-key serif-cn">爭議最少</div>
            <div className="aw-pt-desc">傳統作法，價格透明</div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 最有利標：左邊保留淡化，右邊新出 ───── */
  if (step === 2) {
    return (
      <div className="aw-scene scene-pad">
        <div className="aw-cmp">
          {/* 左：最低標 - 淡化保留 */}
          <div className="aw-cmp-prior">
            <div className="label-mono aw-cmp-prior-ord">I.</div>
            <div className="aw-cmp-prior-title serif-cn">最低標</div>
            <div className="aw-cmp-prior-body">
              比價格
              <br />
              數字說話
            </div>
          </div>

          {/* 中：分隔線 + vs */}
          <div className="aw-cmp-mid">
            <div className="aw-cmp-mid-line aw-cmp-mid-line-top" />
            <div className="serif-it aw-cmp-mid-label">vs.</div>
            <div className="aw-cmp-mid-line aw-cmp-mid-line-bot" />
          </div>

          {/* 右：最有利標 - 主視覺 */}
          <div className="aw-cmp-now">
            <div className="kicker aw-cmp-now-ord">路 · 02 · 第 52 條</div>
            <h2 className="aw-cmp-now-title serif-cn">
              <span className="aw-cmp-now-num serif-it">II.</span>
              <span>最有利標</span>
            </h2>
            <div className="aw-cmp-now-bar" />

            <div className="aw-cmp-now-not">
              <span className="aw-cmp-now-cross">×</span>
              <span className="serif-cn">不只看價格</span>
            </div>

            <div className="aw-cmp-now-yes serif-cn">
              由<span className="aw-accent">評選委員會</span>
              <br />
              按招標文件的標準綜合評選
            </div>

            <div className="aw-cmp-now-meta">
              <span className="label-mono">EVALUATION COMMITTEE</span>
              <span className="aw-cmp-now-dot" />
              <span className="label-mono">綜合評選</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 最有利標常見三類領域 ───── */
  if (step === 3) {
    const fields = [
      { ord: "01", en: "TECHNICAL SERVICES", cn: "技術服務" },
      { ord: "02", en: "CREATIVE DESIGN", cn: "創意設計" },
      { ord: "03", en: "R & D", cn: "研究發展" },
    ];
    return (
      <div className="aw-scene scene-pad">
        <div className="aw-fields-head">
          <div className="kicker aw-fields-kicker">路 · 02 · 常用領域</div>
          <div className="aw-fields-prelude serif-cn">
            這三類，常走<span className="aw-accent">最有利標</span> ——
          </div>
        </div>

        <div className="aw-fields-grid">
          {fields.map((f, i) => (
            <div
              key={f.cn}
              className={`aw-field aw-field-${i + 1}`}
              style={{ ["--i" as string]: i }}
            >
              <div className="label-mono aw-field-ord">{f.ord}</div>
              <div className="label-mono aw-field-en">{f.en}</div>
              <div className="aw-field-cn serif-cn">{f.cn}</div>
              <div className="aw-field-bar" />
            </div>
          ))}
        </div>

        <div className="aw-fields-foot label-mono">
          類別常見 · 非窮舉 · 評選委員會綜合評選
        </div>
      </div>
    );
  }

  /* ───── step 4 — 底價時間線 + §46 ───── */
  return (
    <div className="aw-scene scene-pad">
      <div className="aw-tl-head">
        <div className="kicker aw-tl-kicker">第 46 條 · 底價</div>
        <h2 className="aw-tl-title serif-cn">
          機關還會自己訂一個<span className="aw-accent">底價</span>
        </h2>
      </div>

      <div className="aw-tl">
        {/* §46 stamp — top-right above timeline */}
        <div className="aw-tl-stamp">
          <span className="aw-tl-stamp-section">§</span>
          <span className="aw-tl-stamp-num">46</span>
        </div>

        <div className="aw-tl-stage">
          {/* labels above the axis (T0..T3) */}
          <div className="aw-tl-labels">
            <div className="aw-tl-label aw-tl-label-1">
              <div className="label-mono aw-tl-label-ord">T₀</div>
              <div className="aw-tl-label-name serif-cn">訂底價</div>
            </div>
            <div className="aw-tl-label aw-tl-label-2">
              <div className="label-mono aw-tl-label-ord">T₁</div>
              <div className="aw-tl-label-name serif-cn">開標</div>
            </div>
            <div className="aw-tl-label aw-tl-label-3">
              <div className="label-mono aw-tl-label-ord">T₂</div>
              <div className="aw-tl-label-name serif-cn">決標</div>
            </div>
            <div className="aw-tl-label aw-tl-label-4">
              <div className="label-mono aw-tl-label-ord">T₃</div>
              <div className="aw-tl-label-name serif-cn">事後</div>
            </div>
          </div>

          {/* axis bar + colored spans + nodes (CSS-only, no SVG) */}
          <div className="aw-tl-track">
            <div className="aw-tl-axis" />
            <div className="aw-tl-band aw-tl-band-secret" />
            <div className="aw-tl-band aw-tl-band-open" />
            <div className="aw-tl-node aw-tl-node-1" />
            <div className="aw-tl-node aw-tl-node-2" />
            <div className="aw-tl-node aw-tl-node-3" />
            <div className="aw-tl-node aw-tl-node-4" />
          </div>

          {/* spans labels below the axis */}
          <div className="aw-tl-spans">
            <div className="aw-tl-span aw-tl-span-secret">
              <div className="aw-tl-span-tag serif-cn">必須保密</div>
              <div className="label-mono aw-tl-span-desc">
                BETWEEN BID OPENING AND AWARD
              </div>
            </div>
            <div className="aw-tl-span aw-tl-span-open">
              <div className="aw-tl-span-tag serif-cn">應當公開</div>
              <div className="label-mono aw-tl-span-desc">
                EXCEPT SPECIAL CIRCUMSTANCES
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
