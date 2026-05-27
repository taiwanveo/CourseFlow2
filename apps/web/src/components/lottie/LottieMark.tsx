"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Variant = "logo" | "loading" | "success";

const Lottie = dynamic(() => import("lottie-react").then((m) => m.default), {
  ssr: false,
});

export function LottieMark({
  variant,
  size = 28,
  loop,
  ariaLabel,
  className,
}: {
  variant: Variant;
  size?: number;
  loop?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const path = useMemo(() => `/lottie/${variant}.json`, [variant]);
  const shouldLoop = loop ?? (variant === "loading" || variant === "logo");

  useEffect(() => {
    let cancelled = false;
    fetch(path)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json as Record<string, unknown>);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!data) {
    return (
      <span
        className={className}
        style={{ width: size, height: size, display: "inline-block" }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-block" }}
      aria-label={ariaLabel}
    >
      <Lottie animationData={data} loop={shouldLoop} autoplay />
    </span>
  );
}

