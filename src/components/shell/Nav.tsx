"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/goals", label: "Goals" },
  { href: "/heartbeat", label: "Heartbeat" },
  { href: "/events", label: "Events" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium tracking-tight transition-colors",
              "focus-visible:ring-signal focus-visible:ring-2 focus-visible:outline-none",
              active ? "bg-ink text-canvas" : "text-ink-soft hover:bg-line-soft hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
