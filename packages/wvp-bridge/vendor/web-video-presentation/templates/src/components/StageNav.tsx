import "./StageNav.css";

function IconFirst() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 6L5 12l6 6M18 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLast() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l6 6-6 6M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StageNav({
  onFirst,
  onPrev,
  onNext,
  onLast,
  canPrev,
  canNext,
}: {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <nav className="cf-stage-nav" aria-label="簡報換頁" data-no-advance>
      <div className="cf-stage-nav-col cf-stage-nav-left">
        <button
          type="button"
          className="cf-stage-nav-btn"
          disabled={!canPrev}
          onClick={onFirst}
          aria-label="第一頁"
          title="第一頁（Home）"
        >
          <IconFirst />
        </button>
        <button
          type="button"
          className="cf-stage-nav-btn"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="前一頁"
          title="上一頁（←）"
        >
          <IconPrev />
        </button>
      </div>
      <div className="cf-stage-nav-col cf-stage-nav-right">
        <button
          type="button"
          className="cf-stage-nav-btn"
          disabled={!canNext}
          onClick={onNext}
          aria-label="後一頁"
          title="下一頁（→ 或空白鍵）"
        >
          <IconNext />
        </button>
        <button
          type="button"
          className="cf-stage-nav-btn"
          disabled={!canNext}
          onClick={onLast}
          aria-label="最後一頁"
          title="最後一頁（End）"
        >
          <IconLast />
        </button>
      </div>
    </nav>
  );
}
