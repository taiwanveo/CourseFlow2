import "./AutoStartGate.css";

interface Props {
  visible: boolean;
  onStart(): void;
}

/**
 * Full-screen overlay shown ONCE when `?auto=1` is loaded. Browsers block
 * audio playback until the page receives a user gesture, so we show this
 * gate and let the user press Space (or click) to release auto playback.
 *
 * After the user starts, the gate is hidden for the rest of the session.
 */
export function AutoStartGate({ visible, onStart }: Props) {
  if (!visible) return null;
  return (
    <div
      className="auto-gate"
      data-no-advance
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onStart();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="auto-gate-card">
        <div className="auto-gate-kicker">AUTO PLAYBACK</div>
        <div className="auto-gate-title">點擊或按空白鍵開始</div>
        <div className="auto-gate-sub">
          將依口播自動換頁並播放音訊。
          <br />
          外層預覽可用左右側按鈕手動換頁；按 <kbd>M</kbd> 切換模式。
        </div>
      </div>
    </div>
  );
}
