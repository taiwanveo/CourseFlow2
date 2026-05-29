import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./NoTransfer.css";

export default function NoTransfer({ step }: ChapterStepProps) {
  /* ───── step 0 — 章節 hero：§65 一條紅線「不准轉包」 ───── */
  if (step === 0) {
    return (
      <div className="nt-scene scene-pad">
        <div className="nt-hero-body">
          <div className="nt-hero-meta">
            <div className="kicker nt-hero-kicker">第 4 章 · 履約紅線</div>
            <div className="label-mono nt-hero-cue">
              ARTICLE <span className="nt-hero-cue-num serif-it">65</span>
            </div>
          </div>

          <div className="nt-hero-line-wrap">
            <div className="nt-hero-line" aria-hidden />
            <div className="nt-hero-line-label label-mono">
              <span>RED LINE</span>
              <span className="nt-hero-line-dot" />
            </div>
          </div>

          <h1 className="nt-hero-h serif-cn">
            <MaskReveal show delay={300} duration={700}>
              <span>得標廠商要</span>
            </MaskReveal>
            <MaskReveal show delay={1000} duration={700}>
              <span className="nt-accent">自己做</span>
            </MaskReveal>
            <MaskReveal show delay={1700} duration={500}>
              <span>，</span>
            </MaskReveal>
            <br />
            <MaskReveal show delay={2100} duration={800}>
              <span>不准</span>
            </MaskReveal>
            <MaskReveal show delay={2900} duration={900}>
              <span className="nt-accent nt-hero-strike">轉包</span>
            </MaskReveal>
            <MaskReveal show delay={3800} duration={500}>
              <span>。</span>
            </MaskReveal>
          </h1>

          <div className="nt-hero-foot">
            <div className="nt-hero-foot-tag label-mono">
              履約 · 自行履行原則
            </div>
            <div className="serif-it nt-hero-foot-en">
              Subcontracting in whole or in main part is prohibited.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 1 — 提示卡：兩個詞容易搞混 ───── */
  if (step === 1) {
    return (
      <div className="nt-scene scene-pad nt-center">
        <div className="nt-mix">
          <div className="kicker nt-mix-kicker">注意這個地方</div>

          <div className="nt-mix-pair">
            <span className="serif-cn nt-mix-word nt-mix-word-a">分包</span>
            <span className="nt-mix-vs serif-it" aria-hidden>
              vs
            </span>
            <span className="serif-cn nt-mix-word nt-mix-word-b">轉包</span>
          </div>

          <div className="nt-mix-question serif-cn">
            <MaskReveal show delay={700} duration={900}>
              <span>看起來像，但完全是兩件事。</span>
            </MaskReveal>
          </div>

          <div className="nt-mix-tag-row">
            <span className="label-mono nt-mix-tag">易混淆條目</span>
            <span className="nt-mix-tag-divider" />
            <span className="label-mono nt-mix-tag-mute">§65 / §67</span>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 2 — 並排對比卡：分包 vs 轉包 + 面積條形對比 ───── */
  if (step === 2) {
    return (
      <div className="nt-scene scene-pad">
        <div className="nt-cmp-head">
          <div className="kicker">怎麼分？看「外包多少」</div>
          <div className="nt-cmp-title serif-cn">
            一個是 <span className="nt-accent">一部分</span>，一個是{" "}
            <span className="nt-accent">主要部分</span>
          </div>
        </div>

        <div className="nt-cmp-grid">
          {/* ── 分包（合法） ── */}
          <div className="nt-cmp-card nt-cmp-card-ok">
            <div className="nt-cmp-card-head">
              <div className="label-mono nt-cmp-tag nt-cmp-tag-ok">合法 · §67</div>
              <h3 className="nt-cmp-card-h serif-cn">分包</h3>
            </div>

            <div className="nt-cmp-bar-wrap">
              <div className="nt-cmp-bar">
                <span className="nt-cmp-bar-seg nt-cmp-bar-seg-self">
                  自行履行
                </span>
                <span className="nt-cmp-bar-seg nt-cmp-bar-seg-out nt-cmp-bar-seg-out-ok">
                  外包
                </span>
              </div>
              <div className="nt-cmp-bar-label label-mono">
                <span>主要部分自己做</span>
                <span className="nt-cmp-bar-pct">30%</span>
              </div>
            </div>

            <div className="nt-cmp-card-foot serif-cn">
              把契約的「<span className="nt-accent-soft">一部分</span>」交給其他廠商做。
            </div>
          </div>

          {/* ── 轉包（違法） ── */}
          <div className="nt-cmp-card nt-cmp-card-no">
            <div className="nt-cmp-card-head">
              <div className="label-mono nt-cmp-tag nt-cmp-tag-no">違法 · §65</div>
              <h3 className="nt-cmp-card-h serif-cn">轉包</h3>
            </div>

            <div className="nt-cmp-bar-wrap">
              <div className="nt-cmp-bar">
                <span className="nt-cmp-bar-seg nt-cmp-bar-seg-self nt-cmp-bar-seg-self-no">
                  自行
                </span>
                <span className="nt-cmp-bar-seg nt-cmp-bar-seg-out nt-cmp-bar-seg-out-no">
                  外包
                </span>
              </div>
              <div className="nt-cmp-bar-label label-mono">
                <span>主要部分外包</span>
                <span className="nt-cmp-bar-pct nt-cmp-bar-pct-no">80%</span>
              </div>
            </div>

            <div className="nt-cmp-card-foot serif-cn">
              把「<span className="nt-accent">主要部分</span>」整個外包出去 ——{" "}
              <span className="nt-accent">禁止</span>。
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── step 3 — 違反後果三項：解約 / 終止契約 / 沒收保證金 ───── */
  const consequences = [
    {
      ord: "01",
      cn: "解約",
      en: "TERMINATE BY NOTICE",
    },
    {
      ord: "02",
      cn: "終止契約",
      en: "TERMINATE FOR DEFAULT",
    },
    {
      ord: "03",
      cn: "沒收保證金",
      en: "FORFEIT BOND",
    },
  ];

  return (
    <div className="nt-scene scene-pad">
      <div className="nt-cons-head">
        <div className="kicker">違反 §65 之後</div>
        <div className="nt-cons-title serif-cn">
          機關可以做三件事 <span className="serif-it nt-cons-title-en">§66</span>
        </div>
      </div>

      <div className="nt-cons-list">
        {consequences.map((c, i) => (
          <div
            key={c.ord}
            className={`nt-cons-row nt-cons-row-${i + 1}`}
            style={{ ["--i" as string]: i }}
          >
            <div className="nt-cons-ord label-mono">{c.ord}</div>
            <div className="nt-cons-strike" aria-hidden />
            <div className="nt-cons-cn serif-cn">{c.cn}</div>
            <div className="nt-cons-en serif-it">{c.en}</div>
          </div>
        ))}
      </div>

      <div className="nt-cons-foot">
        <div className="label-mono nt-cons-foot-tag">履約責任</div>
        <div className="nt-cons-foot-line serif-cn">
          簽下去的字，得<span className="nt-accent">自己</span>負責到底。
        </div>
      </div>
    </div>
  );
}
