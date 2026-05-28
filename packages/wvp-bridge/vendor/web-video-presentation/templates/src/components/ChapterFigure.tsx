import "./ChapterFigure.css";
import { useState } from "react";

/** Checkpoint 上傳的章節配圖（非口播文字重複） */
export function ChapterFigure({
  url,
  alt,
  className,
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  if (!url?.trim()) return null;
  const [broken, setBroken] = useState(false);
  return (
    <figure
      className={["cf-chapter-figure", className].filter(Boolean).join(" ")}
      data-no-advance
    >
      {broken ? (
        <div className="cf-chapter-figure-placeholder">
          <span>{alt?.trim() || "圖片載入失敗，請重新生成或改用上傳"}</span>
        </div>
      ) : (
        <img
          src={url}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      )}
    </figure>
  );
}
