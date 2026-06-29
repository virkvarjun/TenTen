import { NextResponse } from "next/server";
import { runLearning } from "@/server/store";
import { env } from "@/lib/env";

/**
 * The nightly learning loop, triggered by Vercel Cron.
 *
 * Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token). Idempotent
 * and safe to re-run: it recomputes the energy curve from the day's check-ins
 * conservatively, at most once per day. When DATABASE_URL is wired (Phase 3
 * persistence), this iterates per user; on the in-memory demo it runs for the
 * single seeded user.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = env.cronSecret();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[cron/learn] CRON_SECRET not set — endpoint is unprotected (dev only).");
  }

  const result = runLearning();
  return NextResponse.json({ ok: true, ...result });
}
