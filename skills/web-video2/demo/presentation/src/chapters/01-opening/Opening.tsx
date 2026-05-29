import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Opening.css";

export default function Opening({ step }: ChapterStepProps) {
  /* ───── step 0 — 問題 01：捷運廠商 ───── */
  if (step === 0) {
    return (
      <div className="op-scene scene-pad">
        <div className="op-q1-body">
          <div className="kicker op-q-tag">問題 · 01</div>
          <h1 className="op-q1-h serif-cn">
            <MaskReveal show duration={700}>
              <span>你猜，蓋你家旁邊那條</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={700} duration={800}>
              <span className="op-accent">捷運的廠商</span>
            </MaskReveal>
            <MaskReveal show delay={1500} duration={700}>
              <span>，是怎麼選出來的？</span>
            </MaskReveal>
          </h1>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 兩問疊加 + 上方淡化保留 ───── */
  if (step === 1) {
    return (
      <div className="op-scene scene-pad">
        <div className="op-q-prior">
          <div className="kicker op-q-tag op-q-tag-dim">問題 · 01</div>
          <p className="op-q-prior-text serif-cn">
            蓋你家旁邊那條<span className="op-accent">捷運的廠商</span>，怎麼選出來的？
          </p>
        </div>
        <hr className="rule op-rule" />

        <div className="op-q23-grid">
          <div className="op-q23-cell op-q23-cell-1">
            <div className="kicker op-q-tag">問題 · 02</div>
            <p className="op-q23-text serif-cn">
              學校的<span className="op-accent">營養午餐</span>誰做？
            </p>
          </div>
          <div className="op-q23-cell op-q23-cell-2">
            <div className="kicker op-q-tag">問題 · 03</div>
            <p className="op-q23-text serif-cn">
              市政府要買兩百臺<span className="op-accent">電腦</span>，找誰買？
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 收束 hero：全都被同一部法律盯著 ───── */
  if (step === 2) {
    return (
      <div className="op-scene scene-pad op-center">
        <div className="op-hook">
          <div className="kicker op-hook-kicker">這些事</div>
          <h2 className="op-hook-h serif-cn">
            <MaskReveal show duration={900}>
              <span>全都被同一部法律盯著。</span>
            </MaskReveal>
          </h2>
          <div className="op-hook-bar" />
        </div>
      </div>
    );
  }

  /* ───── step 3 — 法律 metadata + hero 名稱 ───── */
  if (step === 3) {
    return (
      <div className="op-scene scene-pad">
        <div className="op-meta-row">
          <div className="op-meta-cell op-meta-cell-1">
            <div className="label-mono op-meta-label">PUBLISHED</div>
            <div className="op-meta-value serif-cn">
              民國 <span className="op-meta-year">87</span> 年
            </div>
            <div className="label-mono op-meta-sub">1998</div>
          </div>
          <div className="op-meta-divider" />
          <div className="op-meta-cell op-meta-cell-2">
            <div className="label-mono op-meta-label">ARTICLES</div>
            <div className="op-meta-value serif-cn">
              <span className="hero-num op-meta-num">114</span> 條
            </div>
            <div className="label-mono op-meta-sub">FULL TEXT</div>
          </div>
          <div className="op-meta-divider" />
          <div className="op-meta-cell op-meta-cell-3">
            <div className="label-mono op-meta-label">CHAPTERS</div>
            <div className="op-meta-value serif-cn">
              <span className="hero-num op-meta-num">8</span> 章
            </div>
            <div className="label-mono op-meta-sub">EIGHT PARTS</div>
          </div>
        </div>

        <hr className="rule op-rule-thick" />

        <div className="op-name-body">
          <div className="label-mono op-name-kicker">中華民國 · 立法</div>
          <h1 className="op-name-h serif-cn">
            <MaskReveal show delay={400} duration={1100}>
              <span>政府採購法</span>
            </MaskReveal>
          </h1>
          <div className="op-name-foot serif-it">
            Government Procurement Act
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 4 — 雙列對比 + §4 章戳 ───── */
  if (step === 4) {
    return (
      <div className="op-scene scene-pad">
        <div className="op-cmp-head">
          <div className="kicker">適用範圍</div>
          <div className="op-cmp-title serif-cn">
            它管的，不只是公務員花錢
          </div>
        </div>

        <div className="op-cmp-grid">
          <div className="op-cmp-card op-cmp-card-left">
            <div className="label-mono op-cmp-tag">預設情形</div>
            <h3 className="op-cmp-card-h serif-cn">機關自己花錢</h3>
            <ul className="op-cmp-list">
              <li>政府機關</li>
              <li>公立學校</li>
              <li>公營事業</li>
            </ul>
          </div>

          <div className="op-cmp-bridge">
            <div className="op-cmp-arrow">
              <svg viewBox="0 0 120 24" preserveAspectRatio="none">
                <path
                  d="M 0 12 L 110 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="op-cmp-arrow-line"
                />
                <path
                  d="M 100 4 L 118 12 L 100 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="square"
                  className="op-cmp-arrow-head"
                />
              </svg>
            </div>
            <div className="op-cmp-bridge-label serif-cn">也適用</div>
          </div>

          <div className="op-cmp-card op-cmp-card-right">
            <div className="op-cmp-stamp">
              <span className="op-cmp-stamp-section">§</span>
              <span className="op-cmp-stamp-num">4</span>
            </div>
            <div className="label-mono op-cmp-tag op-cmp-tag-accent">延伸適用</div>
            <h3 className="op-cmp-card-h serif-cn">民間團體拿補助過半</h3>
            <ul className="op-cmp-list">
              <li>法人 / 團體</li>
              <li>補助 <span className="op-accent">≥ 50%</span></li>
              <li>達公告金額</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 5 — 四關鍵字並列 ───── */
  if (step === 5) {
    const keywords = ["公平", "公開", "效率", "品質"];
    return (
      <div className="op-scene scene-pad">
        <div className="op-kw-head">
          <div className="kicker op-kw-kicker">第 1 條 · 設計哲學</div>
          <div className="op-kw-prelude serif-cn">就四個字 ——</div>
        </div>

        <div className="op-kw-grid">
          {keywords.map((kw, i) => (
            <div
              key={kw}
              className={`op-kw-cell op-kw-cell-${i + 1}`}
              style={{
                ["--i" as string]: i,
              }}
            >
              <div className="label-mono op-kw-ord">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="op-kw-word serif-cn">{kw}</div>
              <div className="op-kw-bar" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ───── step 6 — 兆元規模 hero ───── */
  return (
    <div className="op-scene scene-pad op-center">
      <div className="op-scale">
        <div className="op-scale-prelude">
          <div className="kicker op-scale-kicker">台灣 · 每年</div>
        </div>

        <div className="op-scale-hero">
          <span className="op-scale-prefix serif-cn">好幾</span>
          <span className="op-scale-num serif-cn">兆</span>
          <span className="op-scale-suffix serif-cn">元</span>
        </div>

        <div className="op-scale-foot">
          <div className="op-scale-label serif-cn">公帑流向</div>
          <div className="op-scale-rule" />
          <div className="op-scale-tail label-mono">
            全靠這四個字撐著
          </div>
        </div>
      </div>
    </div>
  );
}
