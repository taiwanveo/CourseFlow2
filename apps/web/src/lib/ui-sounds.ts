/** CourseFlow UI 提示音（靜態資源見 public/assets/sounds/） */

const SOUND_PATHS = {
  warning: "/assets/sounds/warning.wav",
  finished: "/assets/sounds/finished.wav",
} as const;

function playSound(src: string) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(src);
    audio.volume = 0.85;
    void audio.play().catch(() => {
      /* 瀏覽器可能阻擋未互動後的自動播放 */
    });
  } catch {
    /* ignore */
  }
}

/** 畫面出現錯誤訊息時（與 Toast error 連動） */
export function playWarningSound() {
  playSound(SOUND_PATHS.warning);
}

/** AI／批次長任務成功完成時 */
export function playFinishedSound() {
  playSound(SOUND_PATHS.finished);
}
