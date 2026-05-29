import type { Narration } from "../../registry/types";

/**
 * Per-step narration for this chapter.
 *
 * Length === number of steps the chapter component renders.
 * Index i === the spoken text for `step === i` in `Example.tsx`.
 *
 * Audio synthesis uses this file directly (see scripts/extract-narrations.ts).
 * Auto-play mode plays `public/audio/<chapter-id>/<i+1>.mp3` at each step
 * and advances when the audio ends (+ a tiny trail pad).
 *
 * Empty string ("") = no audio for this step (silent transition);
 * Auto mode falls back to a short estimate so the presentation still
 * progresses.
 *
 * Rule of thumb: visual animation duration MUST be ≤ narration duration.
 * If your animation needs more time, write longer narration, split the
 * step, or speed the animation up — there is no "minimum hold" knob.
 */
export const narrations: Narration[] = [
  // step 0 — magazine cover
  "這是示例章節的第一步。把這一行換成你這一步的口播文案。",
  // step 1 — split layout
  "第二步。每個陣列元素對應章節裡 step === N 的那一屏。長度必須嚴格相等。",
  // step 2 — pull-quote close
  "第三步。這個陣列就是音訊合成 + 自動播放的唯一真相源——再也不會和章節程式碼漂移。",
];
