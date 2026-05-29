import type { ChapterStepProps } from "../../registry/types";
import "./Closing.css";

const SCENE_CARDS = [
  {
    index: "01",
    kicker: "article",
    title: "技術教學",
    detail: "技術文章 → 教學影片",
  },
  {
    index: "02",
    kicker: "demo",
    title: "產品 demo",
    detail: "功能走查 · 錄屏就能發",
  },
  {
    index: "03",
    kicker: "talk",
    title: "Conference talk",
    detail: "台上講解 · 台下像在看成片",
  },
  {
    index: "04",
    kicker: "course",
    title: "課程內容",
    detail: "章節化拆步 · 一段一段錄",
  },
];

export default function Closing({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="cl-scene scene-pad cl-center" key={step}>
        <div className="cl-question-wrap">
          <div className="cl-question-kicker label-mono">closing / use cases</div>
          <div className="cl-question-rule" aria-hidden />
          <h1 className="cl-question-title">
            適合什麼
            <span className="cl-question-accent">場景？</span>
          </h1>
          <div className="cl-question-stamp" aria-hidden>
            <span className="cl-question-stamp-ring" />
            <span className="cl-question-stamp-text">ready for screen</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="cl-scene scene-pad cl-board" key={step}>
        <div className="cl-board-head">
          <span className="cl-board-kicker label-mono">four fitting formats</span>
          <h2 className="cl-board-title">同一套方法，四種出場方式。</h2>
        </div>

        <div className="cl-card-grid">
          {SCENE_CARDS.map((card) => (
            <article className="cl-card" key={card.index}>
              <div className="cl-card-top">
                <span className="cl-card-index hero-num">{card.index}</span>
                <span className="cl-card-kicker label-mono">{card.kicker}</span>
              </div>
              <h3 className="cl-card-title">{card.title}</h3>
              <p className="cl-card-detail">{card.detail}</p>
              <span className="cl-card-rule" aria-hidden />
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="cl-scene scene-pad cl-contrast" key={step}>
        <div className="cl-reject-row">
          <div className="cl-reject-card">
            <span className="cl-reject-text">不想開 Premiere</span>
            <span className="cl-reject-strike" aria-hidden />
          </div>
          <div className="cl-reject-card">
            <span className="cl-reject-text">不想開 After Effects</span>
            <span className="cl-reject-strike" aria-hidden />
          </div>
        </div>

        <div className="cl-output-band">
          <div className="cl-paper-stack" aria-hidden>
            <span className="cl-paper-sheet cl-paper-sheet-back" />
            <span className="cl-paper-sheet cl-paper-sheet-mid" />
            <span className="cl-paper-sheet cl-paper-sheet-front" />
            <span className="cl-paper-label">文章 / 口播稿</span>
          </div>

          <div className="cl-output-center">
            <div className="cl-output-arrow" aria-hidden>
              <span className="cl-output-line" />
              <span className="cl-output-tip" />
            </div>
            <h2 className="cl-output-hero">但要影片感</h2>
            <p className="cl-output-copy">丟進去，錄屏就能發出去。</p>
          </div>

          <div className="cl-film-frame" aria-hidden>
            <span className="cl-film-screen" />
            <span className="cl-film-caption">錄屏成片</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cl-scene scene-pad cl-finale" key={step}>
      <div className="cl-finale-mark" aria-hidden>
        <span className="cl-finale-paper" />
        <span className="cl-finale-arrow" />
        <span className="cl-finale-screen" />
      </div>

      <div className="cl-finale-copy">
        <p className="cl-finale-kicker label-mono">article in / film out</p>
        <h1 className="cl-finale-title">
          一篇文章或口播稿進去，
          <span className="cl-finale-accent">一支影片出來。</span>
        </h1>
        <p className="cl-finale-desc">這就是 web-video-v2。試試看。</p>
      </div>
    </div>
  );
}
