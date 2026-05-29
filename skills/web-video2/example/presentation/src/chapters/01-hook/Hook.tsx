import type { ChapterStepProps } from "../../registry/types";
import "./Hook.css";

export default function Hook({ step }: ChapterStepProps) {
  // step 1 — hero 大字提問
  if (step === 0) {
    return (
      <div className="hk-scene scene-pad hk-center" key={step}>
        <h1 className="hk-hero-question">
          一篇文章<br />
          <span className="hk-hero-accent">能變成影片？</span>
        </h1>
        <span className="hk-question-mark">?</span>
      </div>
    );
  }

  // step 2 — 反差對照：PPT vs 影片感網頁
  if (step === 1) {
    return (
      <div className="hk-scene scene-pad hk-compare" key={step}>
        <div className="hk-compare-card hk-compare-no">
          <span className="hk-compare-icon">▤</span>
          <span className="hk-compare-label">PPT 翻頁</span>
          <span className="hk-compare-verdict">靜態・無節奏・觀眾走神</span>
          <span className="hk-strike" aria-hidden />
        </div>
        <div className="hk-vs">vs</div>
        <div className="hk-compare-card hk-compare-yes">
          <span className="hk-compare-icon">▶</span>
          <span className="hk-compare-label">影片感網頁</span>
          <span className="hk-compare-verdict">動效・節奏・像剪過的影片</span>
        </div>
      </div>
    );
  }

  // step 3 — 揭示：「但它其實是一個網頁」
  if (step === 2) {
    return (
      <div className="hk-scene scene-pad hk-center" key={step}>
        <div className="hk-reveal-wrap">
          <span className="hk-reveal-kicker label-mono">真相是</span>
          <h1 className="hk-reveal-hero">
            它其實是一個<span className="hk-reveal-underline">網頁</span>
          </h1>
        </div>
      </div>
    );
  }

  // step 4 — 概念卡：web-video-v2
  if (step === 3) {
    return (
      <div className="hk-scene scene-pad hk-center" key={step}>
        <div className="hk-concept-card">
          <span className="hk-concept-badge label-mono">tool</span>
          <h2 className="hk-concept-name">web-video-v2</h2>
          <hr className="rule-accent hk-concept-rule" />
          <p className="hk-concept-desc">
            文章或口播稿 → 16:9 點選驅動網頁
          </p>
        </div>
      </div>
    );
  }

  // step 5 — 流程卡：一條完整的管線圖（非逐項列表）
  if (step === 4) {
    return (
      <div className="hk-scene scene-pad hk-center" key={step}>
        <div className="hk-pipeline">
          <span className="hk-pipe-label">點一下</span>
          <span className="hk-pipe-seg" />
          <span className="hk-pipe-label">畫面推進</span>
          <span className="hk-pipe-seg" />
          <span className="hk-pipe-label">配上口播</span>
          <span className="hk-pipe-seg" />
          <span className="hk-pipe-label">錄屏成片</span>
        </div>
        <p className="hk-pipe-caption label-mono">一鏡到底，無需剪輯</p>
      </div>
    );
  }

  // step 6 — 具體場景：React Hooks 程式碼浮出
  return (
    <div className="hk-scene scene-pad hk-code-demo" key={step}>
      <span className="hk-code-kicker label-mono">example · React Hooks</span>
      <div className="hk-code-block">
        <div className="hk-code-line hk-code-line-1">
          <span className="hk-code-keyword">const</span>{" "}
          <span className="hk-code-var">[count, setCount]</span>{" "}
          <span className="hk-code-op">=</span>{" "}
          <span className="hk-code-fn">useState</span>(0);
        </div>
        <div className="hk-code-line hk-code-line-2">
          <span className="hk-code-keyword">const</span>{" "}
          <span className="hk-code-var">doubled</span>{" "}
          <span className="hk-code-op">=</span>{" "}
          <span className="hk-code-fn">useMemo</span>(() =&gt; count * 2);
        </div>
        <div className="hk-code-line hk-code-line-3">
          <span className="hk-code-keyword">return</span> &lt;
          <span className="hk-code-tag">Counter</span>{" "}
          <span className="hk-code-attr">value</span>=&#123;doubled&#125; /&gt;;
        </div>
      </div>
      <p className="hk-code-caption">
        程式碼一行行浮出來，配上語法高亮 —— 這就是影片感。
      </p>
    </div>
  );
}
