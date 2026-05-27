import { cn } from "@/lib/cn";

const SIZE_CLASS = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-[2.625rem] w-[2.625rem] text-sm",
} as const;

/** 品牌圖示：青綠底 + CF 字樣（與登入／設定頁一致） */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span className={cn("cf-brand-mark", SIZE_CLASS[size], className)} aria-hidden>
      CF
    </span>
  );
}
