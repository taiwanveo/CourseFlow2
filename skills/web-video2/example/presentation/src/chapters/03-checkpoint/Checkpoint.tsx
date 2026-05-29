import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./Checkpoint.css";

const ITEMS = [
  {
    id: "script",
    num: "01",
    title: "稿子",
    file: "script.md",
    question: "稿子寫得行不行？",
  },
  {
    id: "outline",
    num: "02",
    title: "開發計劃",
    file: "outline.md",
    question: "章節切分合不合理？",
  },
  {
    id: "theme",
    num: "03",
    title: "主題",
    file: "theme",
    question: "選哪個視覺主題？",
  },
  {
    id: "assets",
    num: "04",
    title: "素材",
    file: "assets",
    question: "有沒有素材要放進去？",
  },
  {
    id: "mode",
    num: "05",
    title: "開發模式",
    file: "mode",
    question: "逐章／順序／並行，怎麼做？",
  },
] as const;

const MODES = ["逐章確認", "順序開發", "並行開發"] as const;

type ChecklistState = "ghost" | "past" | "active";

export default function Checkpoint({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="ck-scene scene-pad ck-hero" key={step}>
        <header className="ck-masthead">
          <span className="ck-rule" />
          <span className="ck-kicker">checkpoint plan</span>
          <span className="ck-rule" />
        </header>

        <div className="ck-hero-layout">
          <div className="ck-five-wrap" aria-hidden>
            <div className="ck-five hero-num">5</div>
            <div className="ck-five-ledger">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className={`ck-ledger-line ck-ledger-line-${index + 1}`} />
              ))}
            </div>
          </div>

          <div className="ck-hero-copy">
            <span className="label-mono ck-hero-label">停在 checkpoint</span>
            <MaskReveal show duration={1200}>
              <h1 className="ck-hero-title">
                它會停下來，<br />
                問你<span className="ck-hero-accent">五件事</span>
              </h1>
            </MaskReveal>
            <MaskReveal show delay={260} duration={1000}>
              <p className="ck-hero-sub">先把內容、主題、素材與節奏一次對齊，再進網頁開發。</p>
            </MaskReveal>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="ck-scene scene-pad ck-board-scene ck-board-scene-intro" key={step}>
        <header className="ck-masthead">
          <span className="ck-rule" />
          <span className="ck-kicker">checklist · 2 / 5</span>
          <span className="ck-rule" />
        </header>

        <div className="ck-board-layout">
          <ChecklistBoard revealed={2} active={[0, 1]} />
          <aside className="ck-side-card">
            <span className="label-mono ck-side-label">內容先過</span>
            <div className="ck-side-count">2 / 5</div>
            <p className="ck-side-copy">先確認稿子本身，還有章節切分與步數安排。</p>
          </aside>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="ck-scene scene-pad ck-board-scene ck-board-scene-middle" key={step}>
        <header className="ck-masthead">
          <span className="ck-rule" />
          <span className="ck-kicker">checklist · 4 / 5</span>
          <span className="ck-rule" />
        </header>

        <div className="ck-board-layout">
          <ChecklistBoard revealed={4} active={[2, 3]} />
          <aside className="ck-side-card ck-side-card-wide">
            <span className="label-mono ck-side-label">視覺與素材</span>
            <p className="ck-side-copy">主題決定整片氣質。素材決定哪些畫面能真正放進去。</p>
            <div className="ck-side-strips" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="ck-scene scene-pad ck-mode-scene" key={step}>
        <header className="ck-masthead">
          <span className="ck-rule" />
          <span className="ck-kicker">checklist · 5 / 5</span>
          <span className="ck-rule" />
        </header>

        <div className="ck-mode-layout">
          <ChecklistBoard revealed={5} active={[4]} showModes />

          <div className="ck-gate-card">
            <span className="label-mono ck-gate-label">phase 2</span>
            <div className="ck-gate-door">
              <span className="ck-gate-panel ck-gate-panel-left" />
              <span className="ck-gate-panel ck-gate-panel-right" />
              <div className="ck-gate-copy">
                <div className="ck-gate-count">五件事確認完</div>
                <div className="ck-gate-title">才進入網頁開發</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-scene scene-pad ck-proof-scene" key={step}>
      <div className="ck-proof-sheet">
        <div className="ck-proof-head">
          <span className="label-mono ck-proof-label">chapter 1 preview</span>
          <span className="ck-proof-badge">先驗收風格</span>
        </div>

        <div className="ck-proof-page">
          <div className="ck-proof-number hero-num">01</div>
          <div className="ck-proof-copy">
            <MaskReveal show duration={1000}>
              <h1 className="ck-proof-title">第一章做完，先讓你看。</h1>
            </MaskReveal>
            <MaskReveal show delay={220} duration={900}>
              <p className="ck-proof-sub">確認風格對了，後面的章節才繼續。</p>
            </MaskReveal>
          </div>
          <span className="ck-proof-stamp">approved</span>
        </div>
      </div>

      <div className="ck-proof-flow" aria-hidden>
        <div className="ck-proof-track" />
        <div className="ck-proof-node ck-proof-node-now">第一章</div>
        <div className="ck-proof-node">第 2 章</div>
        <div className="ck-proof-node">第 3 章</div>
        <div className="ck-proof-node">第 4 章</div>
      </div>
    </div>
  );
}

function ChecklistBoard({
  revealed,
  active,
  showModes = false,
}: {
  revealed: number;
  active: number[];
  showModes?: boolean;
}) {
  return (
    <div className={`ck-board ck-board-${revealed}`}>
      <div className="ck-progress" aria-hidden>
        <span className="ck-progress-track" />
        <span className="ck-progress-fill" />
        <span className="ck-progress-total">5</span>
      </div>

      <div className="ck-list">
        {ITEMS.map((item, index) => {
          const state: ChecklistState =
            index >= revealed ? "ghost" : active.includes(index) ? "active" : "past";

          return (
            <article
              key={item.id}
              className={`ck-item ck-item-${state} ${item.id === "mode" ? "ck-item-mode" : ""}`}
            >
              <div className="ck-item-head">
                <span className="ck-item-num">{item.num}</span>
                <div className="ck-item-meta">
                  <div className="ck-item-title">{item.title}</div>
                  <div className="ck-item-file">{item.file}</div>
                </div>
              </div>

              {state === "ghost" ? (
                <p className="ck-item-placeholder">待確認</p>
              ) : (
                <>
                  <p className="ck-item-question">{item.question}</p>
                  <ItemVisual id={item.id} showModes={showModes} />
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ItemVisual({
  id,
  showModes,
}: {
  id: (typeof ITEMS)[number]["id"];
  showModes: boolean;
}) {
  if (id === "script") {
    return (
      <div className="ck-lines" aria-hidden>
        <span className="ck-line ck-line-1" />
        <span className="ck-line ck-line-2" />
        <span className="ck-line ck-line-3" />
      </div>
    );
  }

  if (id === "outline") {
    return (
      <div className="ck-outline" aria-hidden>
        <span className="ck-outline-block ck-outline-block-1">章節</span>
        <span className="ck-outline-block ck-outline-block-2">steps</span>
        <span className="ck-outline-block ck-outline-block-3">資訊池</span>
      </div>
    );
  }

  if (id === "theme") {
    return (
      <div className="ck-swatches" aria-hidden>
        <span className="ck-swatch ck-swatch-1" />
        <span className="ck-swatch ck-swatch-2" />
        <span className="ck-swatch ck-swatch-3" />
      </div>
    );
  }

  if (id === "assets") {
    return (
      <div className="ck-assets" aria-hidden>
        <span className="ck-asset-frame ck-asset-frame-wide">16:9</span>
        <span className="ck-asset-frame ck-asset-frame-tall">pull quote</span>
      </div>
    );
  }

  if (!showModes) {
    return <div className="ck-mode-hint">逐章 · 順序 · 並行</div>;
  }

  return (
    <div className="ck-modes" aria-hidden>
      {MODES.map((mode, index) => (
        <span key={mode} className={`ck-mode-pill ${index === 0 ? "ck-mode-pill-active" : ""}`}>
          {mode}
        </span>
      ))}
    </div>
  );
}
