import { useEffect, useMemo, useState } from "react";
import "./SubtitleBar.css";

interface Props {
  /** Text to display — typically `chapter.narrations[step]`. */
  text: string;
  /** Whether the subtitle bar should be rendered. Comes from
   *  `useSubtitleSettings().enabled` (driven by `S` key + `?subs=off`). */
  enabled: boolean;
}

/** Split a narration string into sentences by Chinese/English sentence-end punctuation. */
function splitSentences(text: string): string[] {
  return text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SubtitleBar({ text, enabled }: Props) {
  const sentences = useMemo(() => splitSentences(text ?? ""), [text]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [text]);

  useEffect(() => {
    if (sentences.length <= 1 || idx >= sentences.length - 1) return;
    const current = sentences[idx] ?? "";
    const ms = Math.max(800, current.length * 250);
    const timer = setTimeout(() => setIdx((i) => i + 1), ms);
    return () => clearTimeout(timer);
  }, [idx, sentences]);

  if (!enabled) return null;
  if (!text || !text.trim()) return null;

  const display = sentences.length > 0 ? (sentences[idx] ?? text) : text;

  return (
    <div className="sub-bar" aria-live="polite" aria-atomic="true">
      <div className="sub-bar-text">{display}</div>
    </div>
  );
}
