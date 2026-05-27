"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { rememberSettingsReturnPath } from "@/lib/settings-return";

export function SettingsNavLink({
  className,
  children = "設定",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href="/settings" className={className} onClick={rememberSettingsReturnPath}>
      {children}
    </Link>
  );
}
