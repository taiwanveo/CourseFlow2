import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  show: boolean;
  delay?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}

/**
 * clip-path text wipe. Pair with `.mask-reveal` and `.mask-reveal.in` from
 * animations.css.
 *
 * `.in` is applied one frame after mount so the browser sees the initial
 * clip-path and runs the transition (applying both classes on first paint
 * skips the animation).
 */
export function MaskReveal({
  show,
  delay = 0,
  duration,
  className,
  children,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!show) {
      setRevealed(false);
      return;
    }
    setRevealed(false);
    let delayTimer: number | undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (delay > 0) {
          delayTimer = window.setTimeout(() => setRevealed(true), delay);
        } else {
          setRevealed(true);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (delayTimer != null) clearTimeout(delayTimer);
    };
  }, [show, delay, children]);

  const cls = ["mask-reveal", revealed ? "in" : "", className]
    .filter(Boolean)
    .join(" ");
  const style: CSSProperties = {
    display: "inline-block",
    transitionDelay: revealed ? "0ms" : "0ms",
    ...(duration ? { transitionDuration: `${duration}ms` } : null),
  };
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
