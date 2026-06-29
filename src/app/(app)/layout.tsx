import Link from "next/link";
import { Nav } from "@/components/shell/Nav";
import { ResetDemoButton } from "@/components/shell/ResetDemoButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas text-ink min-h-screen">
      <header className="border-line bg-canvas/85 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <Link href="/today" className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-sm font-semibold tracking-tight">Meridian</span>
            </Link>
            <Nav />
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/onboarding"
              className="text-ink-soft hover:bg-line-soft hover:text-ink rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Recalibrate
            </Link>
            <ResetDemoButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}

/** A small meridian mark: a peak on a baseline. */
function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <path
        d="M2 14 C 6 14, 6 5, 10 5 C 14 5, 14 14, 18 14"
        fill="none"
        stroke="var(--color-peak)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="10" cy="5" r="1.6" fill="var(--color-peak)" />
      <line x1="2" y1="16.5" x2="18" y2="16.5" stroke="var(--color-line)" strokeWidth="1" />
    </svg>
  );
}
