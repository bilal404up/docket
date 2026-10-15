"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const ITEMS = [
  { href: "/app", label: "Inbox", match: (p: string) => p === "/app" || p.startsWith("/app/orders") },
  { href: "/app/add", label: "Add", match: (p: string) => p.startsWith("/app/add") },
  { href: "/app/bake", label: "Bake sheet", match: (p: string) => p.startsWith("/app/bake") },
  { href: "/app/catalog", label: "Catalog", match: (p: string) => p.startsWith("/app/catalog") },
  { href: "/app/activity", label: "Activity", match: (p: string) => p.startsWith("/app/activity") },
  { href: "/app/settings", label: "Settings", match: (p: string) => p.startsWith("/app/settings") },
];

export function AppNav({ variant }: { variant: "rail" | "bar" }) {
  const path = usePathname();
  if (variant === "rail") {
    return (
      <nav aria-label="Main" className="grid gap-1">
        {ITEMS.map((i) => {
          const on = i.match(path);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={cx("flex min-h-[44px] items-center rounded-control px-3 text-sm font-semibold", on ? "bg-ink text-white" : "text-ink-muted hover:bg-line hover:text-ink")}>
              {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-paper lg:hidden">
      {ITEMS.map((i) => {
        const on = i.match(path);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={cx("flex min-h-[56px] items-center justify-center px-0.5 text-center text-[11px] font-semibold leading-tight", on ? "bg-ink text-white" : "text-ink-muted")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
