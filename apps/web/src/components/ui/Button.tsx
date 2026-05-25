import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const variantClass: Record<Variant, string> = {
  primary: "cf-btn-primary",
  secondary: "cf-btn-secondary",
  ghost: "cf-btn-ghost",
  danger: "cf-btn-danger",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("cf-btn", variantClass[variant], size === "sm" && "cf-btn-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
}
