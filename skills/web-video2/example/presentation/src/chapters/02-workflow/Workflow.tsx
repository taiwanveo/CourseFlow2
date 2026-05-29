import type { ChapterStepProps } from "../../registry/types";
import "./Workflow.css";

const phaseLabels = ["內容編寫", "網頁開發", "音訊合成", "錄屏"];

export default function Workflow({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-stack wf-hero-shell">
          <div className="wf-hero-head">
            <span className="label-mono wf-kicker">chapter 02 · workflow</span>
            <span className="wf-hero-num">4</span>
          </div>

          <div className="wf-hero-copy">
            <h1 className="wf-hero-title">四個階段</h1>
            <p className="wf-hero-deck">從稿子，到網頁，到音訊，到錄屏。</p>
          </div>

          <div className="wf-timeline" aria-hidden>
            {phaseLabels.map((label, index) => (
              <div className={`wf-phase wf-phase-${index + 1}`} key={label}>
                <span className="wf-phase-index">0{index + 1}</span>
                <span className="wf-phase-name">{label}</span>
              </div>
            ))}
            <span className="wf-timeline-line" />
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-phase-layout">
          <div className="wf-phase-copy">
            <span className="label-mono wf-kicker">phase 01</span>
            <h2 className="wf-phase-title">內容編寫</h2>
            <p className="wf-phase-desc">先一次產出兩份文件，再停下來對齊五件事。</p>
            <div className="wf-checkpoint-band">
              <span className="wf-checkpoint-label">checkpoint plan</span>
              <span className="wf-checkpoint-items">稿子 / outline / 主題 / 素材 / 開發模式</span>
            </div>
          </div>

          <div className="wf-doc-pair" aria-hidden>
            <article className="wf-doc-card wf-doc-card-script">
              <div className="wf-doc-top">
                <span className="wf-doc-dot" />
                <span className="wf-doc-name">script.md</span>
              </div>
              <div className="wf-doc-lines">
                <span />
                <span />
                <span />
                <span className="wf-doc-accent" />
              </div>
            </article>
            <article className="wf-doc-card wf-doc-card-outline">
              <div className="wf-doc-top">
                <span className="wf-doc-dot" />
                <span className="wf-doc-name">outline.md</span>
              </div>
              <div className="wf-doc-lines wf-doc-grid">
                <span />
                <span />
                <span />
                <span />
              </div>
            </article>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-file-focus wf-file-focus-script">
          <div className="wf-file-shell">
            <div className="wf-file-tab">script.md</div>
            <div className="wf-script-paper" aria-hidden>
              <span className="wf-script-hook">你有沒有想過……</span>
              <span className="wf-script-line" />
              <span className="wf-script-line wf-script-line-short" />
              <span className="wf-script-line" />
            </div>
          </div>

          <div className="wf-file-copy">
            <span className="label-mono wf-kicker">deliverable</span>
            <h2 className="wf-file-title">口播稿</h2>
            <p className="wf-file-desc">B 站風格。短句、口語、有鉤子。</p>
            <div className="wf-chip-row">
              <span className="wf-chip">短句</span>
              <span className="wf-chip">口語</span>
              <span className="wf-chip">有鉤子</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-file-focus wf-file-focus-outline">
          <div className="wf-outline-board" aria-hidden>
            <div className="wf-outline-node wf-outline-node-1">
              <span className="wf-outline-node-label">chapter 1</span>
              <span className="wf-outline-node-text">hook</span>
            </div>
            <div className="wf-outline-node wf-outline-node-2">
              <span className="wf-outline-node-label">chapter 2</span>
              <span className="wf-outline-node-text">workflow</span>
            </div>
            <div className="wf-outline-node wf-outline-node-3">
              <span className="wf-outline-node-label">step map</span>
              <span className="wf-outline-node-text">每步放什麼</span>
            </div>
            <span className="wf-outline-spine" />
          </div>

          <div className="wf-file-copy">
            <span className="label-mono wf-kicker">deliverable</span>
            <h2 className="wf-file-title">開發計劃</h2>
            <p className="wf-file-desc">切章節，切 step，規劃每步螢幕內容。</p>
            <ul className="wf-bullet-stack">
              <li>章節切分</li>
              <li>每步內容</li>
              <li>資訊池掛細節</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-dev-layout">
          <div className="wf-dev-copy">
            <span className="label-mono wf-kicker">phase 02</span>
            <h2 className="wf-phase-title">網頁開發</h2>
            <p className="wf-phase-desc">起一個前端專案，逐章把畫面做出來。</p>
            <div className="wf-tech-row">
              <span className="wf-tech-pill">Vite</span>
              <span className="wf-tech-pill">React</span>
              <span className="wf-tech-pill">TypeScript</span>
            </div>
            <p className="wf-approval-note">第 1 章先驗收風格，確認後才繼續。</p>
          </div>

          <div className="wf-browser" aria-hidden>
            <div className="wf-browser-top">
              <span className="wf-browser-dot" />
              <span className="wf-browser-dot" />
              <span className="wf-browser-dot" />
              <span className="wf-browser-url">localhost:5173</span>
            </div>
            <div className="wf-browser-stage">
              <div className="wf-browser-panel wf-browser-panel-main">
                <span className="wf-browser-caption">chapter by chapter</span>
                <span className="wf-browser-frame" />
              </div>
              <div className="wf-browser-sidebar">
                <span className="wf-browser-tag wf-browser-tag-1">01 hook</span>
                <span className="wf-browser-tag wf-browser-tag-2">02 workflow</span>
                <span className="wf-browser-tag wf-browser-tag-3">03 checkpoint</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-manifesto">
          <div className="wf-manifesto-left">
            <span className="wf-manifesto-no">不是 PPT</span>
            <span className="wf-manifesto-rule" />
          </div>
          <div className="wf-manifesto-right">
            <h2 className="wf-manifesto-yes">每步佔滿全螢幕</h2>
            <p className="wf-manifesto-copy">動畫看著內容現場設計，不是套模板。</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="wf-scene scene-pad" key={step}>
        <div className="wf-audio-layout">
          <div className="wf-audio-copy">
            <span className="label-mono wf-kicker">phase 03 · optional</span>
            <h2 className="wf-phase-title">音訊合成</h2>
            <p className="wf-phase-desc">要配音就走本機；沒有本機工具，再退到 CLI。</p>
          </div>

          <div className="wf-audio-route" aria-hidden>
            <div className="wf-audio-source">narrations.ts</div>
            <span className="wf-audio-split" />
            <div className="wf-audio-path wf-audio-path-primary">
              <span className="wf-audio-tool">IndexTTS2</span>
              <span className="wf-audio-meta">本機 GPU</span>
            </div>
            <div className="wf-audio-path wf-audio-path-secondary">
              <span className="wf-audio-tool">MiniMax CLI</span>
              <span className="wf-audio-meta">fallback</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-scene scene-pad" key={step}>
      <div className="wf-record-layout">
        <div className="wf-record-copy">
          <span className="label-mono wf-kicker">phase 04</span>
          <h2 className="wf-phase-title">錄屏</h2>
          <p className="wf-phase-desc">全螢幕打開瀏覽器，一邊點，一邊念。</p>
          <div className="wf-auto-chip">?auto=1 自動播放</div>
        </div>

        <div className="wf-record-window" aria-hidden>
          <div className="wf-record-url">localhost:5173/?auto=1</div>
          <div className="wf-record-stage">
            <span className="wf-record-playhead" />
            <span className="wf-record-progress" />
            <span className="wf-record-caption">fullscreen · recording</span>
          </div>
        </div>
      </div>
    </div>
  );
}
