// ⚠️ 這是 anchor 參考程式碼，不會被任何專案編譯。
//    抄到真實專案時（presentation/src/chapters/NN-hook/），
//    把下面兩個 import 改成：
//      import { MaskReveal } from "../../components/MaskReveal";
//      import type { ChapterStepProps } from "../../registry/types";
import { MaskReveal } from "../../../templates/src/components/MaskReveal";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
import "./chapter.css";

/**
 * hook-chapter · 完整章節示例
 * ─────────────────────────────────────────
 * 預設綁 newsroom 主題（serif + 報頭紅 + 印刷蓋章 motion）。
 *
 * 關鍵手段：
 * - 真素材：<img src="/hook/{name}.png" /> 而不是 placeholder
 * - 字號狠對比：hero 用 --t-display-1（≥ 144px）+ 微微負字距
 * - 主導動作：mask reveal + 印章砸下（貼 newsroom 印刷氣質）
 * - takeover：三張圖縮入 + 巨字爆出 + accent 紅條貫穿
 * - 收束：brush 劃掉舊概念
 *
 * 切其它主題時按那個主題的氣質自由換"印章砸下 / brush"等效動作，
 * 結構和字號節奏保持。
 */
export default function HookChapter({ step }: ChapterStepProps) {
  // step 1 — 三張 ghost（精修：加 kicker 引子 + accent 紅條）
  if (step === 0) {
    return (
      <div className="hk-scene scene-pad">
        <div className="hk-kicker">
          <span className="hk-kicker-line" />
          <span className="hk-kicker-text">這幾天</span>
        </div>
        <div className="hk-grid" key={step}>
          {["01", "02", "03"].map((i, idx) => (
            <MaskReveal show key={i} delay={idx * 200} duration={900}>
              <div className="hk-ghost">
                <span className="hk-ghost-num">{i}</span>
                <span className="hk-ghost-label">image</span>
              </div>
            </MaskReveal>
          ))}
        </div>
      </div>
    );
  }

  // step 2-4 — 每張圖獨佔（真素材 + 角章 + 旁白）
  // ⚠️ 這是結構示例。具體反例 caption / src 應該來自 outline.md 本章
  //    article 補欄位（雙源原則）—— 別照抄下面這些佔位字串。
  const reveals: Array<{ src: string; label: string; caption: string }> = [
    {
      src: "/hook/<asset-1>.png",
      label: "01 / 03",
      caption: "<反例 1 caption，來自 article §X>",
    },
    {
      src: "/hook/<asset-2>.png",
      label: "02 / 03",
      caption: "<反例 2 caption>",
    },
    {
      src: "/hook/<asset-3>.png",
      label: "03 / 03",
      caption: "<反例 3 caption>",
    },
  ];
  if (step >= 1 && step <= 3) {
    const r = reveals[step - 1];
    return (
      <div className="hk-scene scene-pad" key={step}>
        <div className="hk-solo-frame">
          <MaskReveal show duration={1100}>
            <div className="hk-solo-img-wrap">
              <img className="hk-solo-img" src={r.src} alt={r.caption} />
              <div className="hk-stamp">FAKE?</div>
            </div>
          </MaskReveal>
          <MaskReveal show delay={400} duration={900}>
            <div className="hk-solo-meta">
              <span className="hk-solo-label">{r.label}</span>
              <span className="hk-solo-caption">{r.caption}</span>
            </div>
          </MaskReveal>
        </div>
      </div>
    );
  }

  // step 5 — takeover：三張縮入 + 巨字爆出 + accent 紅條
  if (step === 4) {
    return (
      <div className="hk-scene scene-pad hk-takeover" key={step}>
        <div className="hk-mini-row">
          {reveals.map((r, idx) => (
            <img
              key={r.src}
              className="hk-mini"
              src={r.src}
              alt={r.caption}
              style={{ animationDelay: `${idx * 80}ms` }}
            />
          ))}
        </div>
        <span className="hk-accent-bar" />
        <h1 className="hk-hero">
          <MaskReveal show duration={1100}>
            {/* hero 文案來自 outline 本章 step 5；這裡只是佔位 */}
            &lt;主題大字 takeover&gt;
          </MaskReveal>
        </h1>
      </div>
    );
  }

  // step 6 — 鉤子收束：brush 劃掉
  return (
    <div className="hk-scene scene-pad hk-close" key={step}>
      <div className="hk-quote-wrap">
        <h2 className="hk-quote">&lt;下一句鉤子&gt;</h2>
        <span className="hk-brush" aria-hidden />
      </div>
    </div>
  );
}
