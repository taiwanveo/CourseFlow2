import {
  useCallback,
  useEffect,
  useState,
  type IframeHTMLAttributes,
  type SyntheticEvent,
} from "react";
import "./SafeAnimationFrame.css";

/** 原始 HTML 字串是否不適合嵌入 iframe（純文字原始碼、404 頁等） */
export function animationHtmlSourceLooksBroken(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) return true;
  if (/^Not found$/i.test(trimmed) || /^未登入$/i.test(trimmed)) return true;
  if (!/<html[\s>]/i.test(trimmed) && !/<!DOCTYPE/i.test(trimmed)) return true;

  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch?.[1]?.replace(/<script[\s\S]*?<\/script>/gi, "").trim() ?? "";
  if (bodyInner && /^<!DOCTYPE\s+html/i.test(bodyInner)) return true;
  if (bodyInner && /^<html[\s>]/i.test(bodyInner)) return true;

  const visible = bodyInner
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (visible && /^<!DOCTYPE/i.test(visible.slice(0, 32))) return true;
  if (visible && /^<html[\s>]/i.test(visible.slice(0, 16))) return true;

  return false;
}

/** iframe 內是否把 HTML 原始碼當成可見文字（text/plain 或損壞檔） */
function animationFrameLooksBroken(iframe: HTMLIFrameElement): boolean {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return false;
    const visible = (doc.body?.innerText ?? doc.documentElement?.innerText ?? "").trim();
    if (!visible) return doc.body?.childElementCount === 0;
    return animationHtmlSourceLooksBroken(visible);
  } catch {
    return false;
  }
}

export function SafeAnimationFrame({
  className,
  failLabel = "動畫",
  onLoad,
  src,
  srcDoc,
  title,
  ...rest
}: IframeHTMLAttributes<HTMLIFrameElement> & { failLabel?: string }) {
  const [failed, setFailed] = useState(false);
  const [resolvedDoc, setResolvedDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFailed(false);
    setResolvedDoc(null);
    if (srcDoc?.trim()) return;
    const url = src?.trim();
    if (!url) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (cancelled) return;
        const text = await res.text();
        if (!res.ok || animationHtmlSourceLooksBroken(text)) {
          setFailed(true);
          return;
        }
        setResolvedDoc(text);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      setLoading(false);
    };
  }, [src, srcDoc]);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLIFrameElement>) => {
      if (animationFrameLooksBroken(e.currentTarget)) {
        setFailed(true);
      }
      onLoad?.(e);
    },
    [onLoad],
  );

  const inlineDoc = srcDoc?.trim() || resolvedDoc?.trim() || "";

  if (failed) {
    return null;
  }

  if (!inlineDoc) {
    if (loading && src?.trim()) {
      return null;
    }
    if (!src?.trim()) {
      return null;
    }
  }

  if (!inlineDoc && !src?.trim()) {
    return null;
  }

  return (
    <iframe
      {...rest}
      className={className}
      src={inlineDoc ? undefined : src}
      srcDoc={inlineDoc || undefined}
      title={title ?? failLabel}
      onLoad={handleLoad}
    />
  );
}
