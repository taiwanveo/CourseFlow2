import "./ChapterFigure.css";

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
  return (
    <figure
      className={["cf-chapter-figure", className].filter(Boolean).join(" ")}
      data-no-advance
    >
      <img src={url} alt={alt ?? ""} loading="lazy" decoding="async" />
    </figure>
  );
}
