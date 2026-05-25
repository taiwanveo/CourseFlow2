import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  width?: "default" | "narrow" | "wide";
  headerActions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
};

export function AppShell({
  children,
  title,
  description,
  width = "default",
  headerActions,
  breadcrumb,
}: AppShellProps) {
  return (
    <div className="cf-shell">
      <header className="cf-topbar">
        <div className="cf-topbar-inner">
          <Link href="/dashboard" className="cf-brand">
            <span className="cf-brand-mark" aria-hidden>
              CF
            </span>
            <span>CourseFlow</span>
          </Link>
          <nav className="cf-nav-actions" aria-label="主要導覽">
            <Link href="/dashboard" className="cf-btn cf-btn-ghost cf-btn-sm">
              我的專案
            </Link>
            <Link href="/settings" className="cf-btn cf-btn-ghost cf-btn-sm">
              設定
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="cf-btn cf-btn-secondary cf-btn-sm">
                登出
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main
        className={cn(
          "cf-page",
          width === "narrow" && "cf-page-narrow",
          width === "wide" && "cf-page-wide",
        )}
      >
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500" aria-label="麵包屑">
            {breadcrumb.map((item, i) => (
              <span key={`${item.label}-${i}`} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-zinc-300">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-zinc-400">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        {title ? (
          <div className="cf-page-header">
            <div>
              <h1 className="cf-page-title">{title}</h1>
              {description ? <p className="cf-page-desc">{description}</p> : null}
            </div>
            {headerActions ? <div className="cf-nav-actions">{headerActions}</div> : null}
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
