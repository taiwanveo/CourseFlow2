/** WVP 步驟配圖路徑（與 audio 相同：1-based 檔名對應 step+1） */
export function wvpStepImageFileName(stepIndex0: number): string {
  return `${String(stepIndex0 + 1).padStart(2, "0")}.jpg`;
}

export function wvpStepImageRelPath(wvpChapterId: string, stepIndex0: number): string {
  return `images/${wvpChapterId}/${wvpStepImageFileName(stepIndex0)}`;
}
