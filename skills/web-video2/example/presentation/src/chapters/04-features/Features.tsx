import type { ChapterStepProps } from "../../registry/types";
import "./Features.css";

const MENU_BUTTONS = ["restart", "pause", "play", "auto", "1.25×", "pdf"];
const REPORT_ROWS = [
  { label: "Font size ≥ 24px", status: "ok" },
  { label: "Overflow inside stage", status: "issue" },
  { label: "Page number placement", status: "ok" },
  { label: "Subtitle text match", status: "ok" },
];
const DIALOGUE_EXAMPLES = [
  "重寫 2.3",
  "2.1 的字太小",
  "第 3 章太快",
];
const SUMMARY_FEATURES = [
  { code: "01", title: "字幕條", note: "同步顯示當前 step" },
  { code: "02", title: "頂部功能表", note: "hover 才出現" },
  { code: "03", title: "PDF 匯出", note: "每步一頁" },
  { code: "04", title: "頁碼定址", note: "2.3 直接點頁" },
  { code: "05", title: "Fit 模式", note: "contain / cover" },
  { code: "06", title: "自動自檢", note: "Playwright 掃描" },
];

export default function Features({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="ft-scene scene-pad ft-center" key={step}>
        <span className="ft-kicker label-mono">chapter 04 · features</span>
        <div className="ft-hero-wrap">
          <div className="ft-hero-num hero-num">6</div>
          <div className="ft-hero-copy">
            <h1 className="ft-hero-title">六項功能</h1>
            <p className="ft-hero-text">產出的網頁，連演講、錄屏、對話與自檢都先幫你裝好了。</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="ft-scene scene-pad ft-split" key={step}>
        <div className="ft-copy-block">
          <span className="ft-kicker label-mono">feature 01 · subtitle bar</span>
          <h2 className="ft-step-title">念到哪一步，字就走到哪一步</h2>
          <p className="ft-step-text">底部字幕條直接讀 narrations。畫面推進，字幕也跟著切。</p>
        </div>
        <div className="ft-browser ft-browser-subtitle">
          <div className="ft-browser-top">
            <span className="ft-dot" />
            <span className="ft-dot" />
            <span className="ft-dot" />
          </div>
          <div className="ft-stage-preview">
            <div className="ft-preview-headline" />
            <div className="ft-preview-line ft-preview-line-long" />
            <div className="ft-preview-line" />
            <div className="ft-subtitle-bar">
              <span>底部有字幕條。你念到哪步，下面就同步顯示那步的文字。</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="ft-scene scene-pad ft-split" key={step}>
        <div className="ft-browser ft-browser-menu">
          <div className="ft-hover-strip label-mono">hover zone · top 5vh</div>
          <div className="ft-top-menu-demo">
            {MENU_BUTTONS.map((button) => (
              <span className="ft-menu-button" key={button}>
                {button}
              </span>
            ))}
          </div>
          <div className="ft-menu-stage" />
        </div>
        <div className="ft-copy-block ft-copy-tight">
          <span className="ft-kicker label-mono">feature 02 · top menu</span>
          <h2 className="ft-step-title">平時隱形，滑上去才浮出來</h2>
          <p className="ft-step-text">暫停、播放、自動播放、速度切換、下載 PDF，全在上面這一列。</p>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="ft-scene scene-pad ft-split" key={step}>
        <div className="ft-pdf-stack" aria-hidden>
          <div className="ft-pdf-sheet ft-pdf-sheet-back" />
          <div className="ft-pdf-sheet ft-pdf-sheet-mid" />
          <div className="ft-pdf-sheet ft-pdf-sheet-front">
            <span className="ft-pdf-tag label-mono">step 4 / 10</span>
            <div className="ft-pdf-title">每步一頁</div>
            <div className="ft-pdf-rule" />
            <div className="ft-pdf-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="ft-copy-block">
          <span className="ft-kicker label-mono">feature 03 · export pdf</span>
          <h2 className="ft-step-title">按一下，直接變簡報</h2>
          <p className="ft-step-text">TopMenu 的 Download PDF 走列印樣式。一個 step，就是一頁。</p>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="ft-scene scene-pad ft-address-step" key={step}>
        <div className="ft-address-number hero-num">2.3</div>
        <div className="ft-address-card">
          <span className="ft-kicker label-mono">feature 04 · page address</span>
          <p className="ft-address-text">第 2 章第 3 步</p>
          <div className="ft-chat-bubble">重寫 2.3</div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="ft-scene scene-pad ft-compare-fit" key={step}>
        <div className="ft-fit-card">
          <span className="ft-kicker label-mono">contain</span>
          <div className="ft-viewport ft-viewport-contain">
            <div className="ft-mini-stage ft-mini-stage-contain">
              <div className="ft-mini-headline" />
              <div className="ft-mini-frame" />
            </div>
          </div>
          <p className="ft-fit-note">保比例，不裁切，有黑邊。</p>
        </div>
        <div className="ft-fit-divider">vs</div>
        <div className="ft-fit-card ft-fit-card-cover">
          <span className="ft-kicker label-mono">?fit=cover</span>
          <div className="ft-viewport ft-viewport-cover">
            <div className="ft-mini-stage ft-mini-stage-cover">
              <div className="ft-mini-headline" />
              <div className="ft-mini-frame" />
            </div>
          </div>
          <p className="ft-fit-note">填滿畫面，沒有黑邊。</p>
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="ft-scene scene-pad ft-split" key={step}>
        <div className="ft-report-card">
          <div className="ft-report-head">
            <span className="ft-kicker label-mono">feature 06 · self-check</span>
            <span className="ft-report-file">self-check-report.html</span>
          </div>
          <div className="ft-report-body">
            {REPORT_ROWS.map((row) => (
              <div className="ft-report-row" key={row.label}>
                <span className={`ft-report-status ft-report-status-${row.status}`}>{row.status === "ok" ? "pass" : "warn"}</span>
                <span className="ft-report-label">{row.label}</span>
              </div>
            ))}
          </div>
          <span className="ft-report-scan" aria-hidden />
        </div>
        <div className="ft-copy-block">
          <span className="ft-kicker label-mono">Playwright 巡所有 steps</span>
          <h2 className="ft-step-title">字太小、內容溢出，都會報</h2>
          <p className="ft-step-text">它不是只截圖，還會量字級、查 overflow、驗字幕與頁碼位置。</p>
        </div>
      </div>
    );
  }

  if (step === 7) {
    return (
      <div className="ft-scene scene-pad ft-split" key={step}>
        <div className="ft-url-board">
          <span className="ft-kicker label-mono">url params</span>
          <div className="ft-url-line">
            <span className="ft-url-mark">?</span>
            <span className="ft-url-key">recording</span>
            <span className="ft-url-eq">=</span>
            <span className="ft-url-value">1</span>
          </div>
          <div className="ft-url-line">
            <span className="ft-url-mark">?</span>
            <span className="ft-url-key">subs</span>
            <span className="ft-url-eq">=</span>
            <span className="ft-url-value">off</span>
          </div>
        </div>
        <div className="ft-parameter-notes">
          <div className="ft-parameter-card">
            <span className="ft-parameter-title">?recording=1</span>
            <span className="ft-parameter-text">TopMenu / PageNumber 全藏起來</span>
          </div>
          <div className="ft-parameter-card ft-parameter-card-muted">
            <span className="ft-parameter-title">?subs=off</span>
            <span className="ft-parameter-text">字幕單獨關掉</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === 8) {
    return (
      <div className="ft-scene scene-pad ft-dialogue-grid" key={step}>
        <div className="ft-dialogue-header">
          <span className="ft-kicker label-mono">conversation targeting</span>
          <h2 className="ft-step-title">直接用頁碼點名修改</h2>
        </div>
        <div className="ft-dialogue-list">
          {DIALOGUE_EXAMPLES.map((example, index) => (
            <div className="ft-dialogue-card" key={example}>
              <span className="ft-dialogue-index">0{index + 1}</span>
              <span className="ft-dialogue-text">{example}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ft-scene scene-pad ft-summary" key={step}>
      <div className="ft-summary-head">
        <span className="ft-kicker label-mono">all built in</span>
        <h2 className="ft-summary-title">不用額外設定</h2>
      </div>
      <div className="ft-summary-grid">
        {SUMMARY_FEATURES.map((feature) => (
          <div className="ft-summary-card" key={feature.code}>
            <span className="ft-summary-code">{feature.code}</span>
            <span className="ft-summary-name">{feature.title}</span>
            <span className="ft-summary-note">{feature.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
