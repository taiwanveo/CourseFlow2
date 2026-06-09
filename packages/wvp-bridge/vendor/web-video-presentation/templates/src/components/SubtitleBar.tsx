import { useEffect, useMemo, useState } from "react";
import "./SubtitleBar.css";

interface Props {
  /** Text to display — typically `chapter.narrations[step]`. */
  text: string;
  /** Whether the subtitle bar should be rendered. Comes from
   *  `useSubtitleSettings().enabled` (driven by `S` key + `?subs=off`). */
  enabled: boolean;
  /** 與本步 TTS 共用的 `<audio>`，句內切換依實際播放進度對齊 */
  audioElement?: HTMLAudioElement | null;
  /** 自動／音訊模式：依播放進度逐句顯示；手動模式應為 false（固定全文） */
  sentenceSync?: boolean;
}

/** Split a narration string into sentences by Chinese/English sentence-end punctuation. */
function splitSentences(text: string): string[] {
  return text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sentenceIndexForProgress(
  sentences: string[],
  ratio: number,
): number {
  if (sentences.length <= 1) return 0;
  const weights = sentences.map((s) => Math.max(1, s.replace(/\s+/g, "").length));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const clamped = Math.min(1, Math.max(0, ratio));
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]! / total;
    if (clamped <= acc) return i;
  }
  return sentences.length - 1;
}

function estimateSentenceMs(sentence: string): number {
  return Math.max(1200, sentence.replace(/\s+/g, "").length * 280);
}

export function SubtitleBar({
  text,
  enabled,
  audioElement = null,
  sentenceSync = false,
}: Props) {
  const sentences = useMemo(() => splitSentences(text ?? ""), [text]);
  const [idx, setIdx] = useState(0);
  const [audioSyncReady, setAudioSyncReady] = useState(false);

  useEffect(() => {
    setIdx(0);
    setAudioSyncReady(false);
  }, [text, audioElement]);

  useEffect(() => {
    if (!sentenceSync || sentences.length <= 1) {
      setAudioSyncReady(false);
      return;
    }
    const audio = audioElement;
    if (!audio) {
      setAudioSyncReady(false);
      return;
    }

    const syncIdx = () => {
      const duration = audio.duration;
      const current = audio.currentTime;
      if (!Number.isFinite(duration) || duration <= 0) {
        setAudioSyncReady(false);
        return;
      }
      setAudioSyncReady(true);
      setIdx(sentenceIndexForProgress(sentences, current / duration));
    };

    audio.addEventListener("loadedmetadata", syncIdx);
    audio.addEventListener("durationchange", syncIdx);
    audio.addEventListener("timeupdate", syncIdx);
    audio.addEventListener("seeked", syncIdx);
    audio.addEventListener("playing", syncIdx);
    audio.addEventListener("ended", syncIdx);
    syncIdx();
    return () => {
      audio.removeEventListener("loadedmetadata", syncIdx);
      audio.removeEventListener("durationchange", syncIdx);
      audio.removeEventListener("timeupdate", syncIdx);
      audio.removeEventListener("seeked", syncIdx);
      audio.removeEventListener("playing", syncIdx);
      audio.removeEventListener("ended", syncIdx);
    };
  }, [audioElement, sentences, text, sentenceSync]);

  // 音訊 metadata 尚未就緒時，用估時逐句推進（避免卡在第一句）
  useEffect(() => {
    if (!sentenceSync || sentences.length <= 1) return;
    if (audioSyncReady) return;
    if (idx >= sentences.length - 1) return;

    const timer = window.setTimeout(() => {
      setIdx((i) => (i < sentences.length - 1 ? i + 1 : i));
    }, estimateSentenceMs(sentences[idx] ?? ""));
    return () => clearTimeout(timer);
  }, [idx, sentences, audioSyncReady, text, sentenceSync]);

  if (!enabled) return null;
  if (!text || !text.trim()) return null;

  const display =
    !sentenceSync || sentences.length <= 1
      ? text
      : (sentences[idx] ?? text);

  return (
    <div className="sub-bar" aria-live="polite" aria-atomic="true">
      <div className="sub-bar-text">{display}</div>
    </div>
  );
}
