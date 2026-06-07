import { useCallback, useState, type IframeHTMLAttributes, type SyntheticEvent } from "react";
import "./SafeAnimationFrame.css";

const DEFAULT_FAIL_LABEL = "動畫載入失敗，請在視覺動效重新生成";

/** iframe 內是否把 HTML 原始碼當成可見文字（text/plain 或損壞檔） */
function animationFrameLooksBroken(iframe: HTMLIFrameElement): boolean {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return false;
    const visible = (doc.body?.innerText ?? doc.documentElement?.innerText ?? "").trim();
    if (!visible) return doc.body?.childElementCount === 0;
    if (/^<!DOCTYPE\s+html/i.test(visible) || /^<html[\s>]/i.test(visible)) return true;
    if (/^Not found$/i.test(visible) || /^未登入$/i.test(visible)) return true;
    if (/^<!DOCTYPE/i.test(visible.slice(0, 32))) return true;
    return false;
  } catch {
    return false;
  }
}

export function SafeAnimationFrame({
  className,
  failLabel = DEFAULT_FAIL_LABEL,
  onLoad,
  src,
  srcDoc,
  title,
  ...rest
}: IframeHTMLAttributes<HTMLIFrameElement> & { failLabel?: string }) {
  const [failed, setFailed] = useState(false);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLIFrameElement>) => {
      if (animationFrameLooksBroken(e.currentTarget)) {
        setFailed(true);
      }
      onLoad?.(e);
    },
    [onLoad],
  );

  if (failed || (!src?.trim() && !srcDoc?.trim())) {
    return (
      <div
        className={["cf-anim-fallback", className].filter(Boolean).join(" ")}
        role="img"
        aria-label={failLabel}
        data-no-advance
      >
        <span>{failLabel}</span>
      </div>
    );
  }

  return (
    <iframe
      {...rest}
      className={className}
      src={src}
      srcDoc={srcDoc}
      title={title ?? ""}
      onLoad={handleLoad}
    />
  );
}
