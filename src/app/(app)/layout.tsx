import Link from "next/link";
import { Nav } from "@/components/shell/Nav";
import { ResetDemoButton } from "@/components/shell/ResetDemoButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <Link href="/today" className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <span className="text-sm font-semibold tracking-tight">Meridian</span>
            </Link>
            <Nav />
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/onboarding"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
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
