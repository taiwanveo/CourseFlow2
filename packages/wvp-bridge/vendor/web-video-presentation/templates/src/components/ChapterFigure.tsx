import "./ChapterFigure.css";
import { useState } from "react";

/** Checkpoint 上傳的章節配圖（非口播文字重複） */
export function ChapterFigure({
  url,
  alt,
  className,
  optional = false,
}: {
  url: string;
  alt?: string;
  className?: string;
  /** 選用配圖：載入失敗時不顯示佔位，版面改以標題為主 */
  optional?: boolean;
}) {
  if (!url?.trim()) return null;
  const [broken, setBroken] = useState(false);
  if (optional && broken) return null;
  return (
    <figure
      className={["cf-chapter-figure", className].filter(Boolean).join(" ")}
      data-no-advance
    >
      {broken && !optional ? (
        <div className="cf-chapter-figure-placeholder">
          <span>{alt?.trim() || "圖片載入失敗，請重新生成或改用上傳"}</span>
        </div>
      ) : broken ? null : (
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
