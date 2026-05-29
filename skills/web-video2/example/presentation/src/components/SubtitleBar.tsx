import "./SubtitleBar.css";

interface Props {
  /** Text to display — typically `chapter.narrations[step]`. */
  text: string;
  /** Whether the subtitle bar should be rendered. Comes from
   *  `useSubtitleSettings().enabled` (driven by `S` key + `?subs=off`). */
  enabled: boolean;
}

/**
 * Bottom subtitle bar.
 *
 * Renders the current step's narration verbatim — whatever language the
 * user wrote, that's what appears (no language switch UI).
 *
 * Visibility rules:
 *   • Default ON. The subtitle is itself recording content.
 *   • `?subs=off` or pressing `S` → off (via useSubtitleSettings).
 *   • `?recording=1` does NOT hide subtitles — only the chrome elements
 *     (TopMenu / PageNumber) honor that flag.
 *   • `mode === 'auto' | 'section'` does NOT hide subtitles either.
 *
 * Renders nothing when disabled or when the narration is empty (silent
 * step) — an empty black bar would just be visual noise.
 */
export function SubtitleBar({ text, enabled }: Props) {
  if (!enabled) return null;
  if (!text || !text.trim()) return null;
  return (
    <div className="sub-bar" aria-live="polite" aria-atomic="true">
      <div className="sub-bar-text">{text}</div>
    </div>
  );
}
