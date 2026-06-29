import type { Ask } from "@/domain/types";
import { atHour } from "@/domain/time";

/**
 * A small, deterministic natural-language parser for incoming asks like
 * "Raj wants to run at 4, ~45 min". Phase 3's LLM engine can parse richer
 * phrasing; this keeps Phase 2 dependency-free and predictable.
 */

const DEFAULT_DURATION_MIN = 60;

/** Extract a duration in minutes from free text, or a sensible default. */
function parseDurationMin(text: string): number {
  const t = text.toLowerCase();

  // "an hour", "half an hour"
  if (/half an hour|30\s*min/.test(t)) return 30;
  const hourMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch?.[1]) return Math.round(parseFloat(hourMatch[1]) * 60);
  const minMatch = t.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch?.[1]) return parseInt(minMatch[1], 10);
  if (/\ban hour\b/.test(t)) return 60;

  return DEFAULT_DURATION_MIN;
}

/**
 * Extract a start hour (0–23) from free text, or null if none stated. Resolves
 * bare numbers ("at 4") toward the likely time of day.
 */
function parseStartHour(text: string): number | null {
  const t = text.toLowerCase();

  // 24h clock, e.g. "16:00", "9:30"
  const clock = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clock?.[1] && clock[2]) {
    const h = parseInt(clock[1], 10);
    const m = parseInt(clock[2], 10);
    if (h >= 0 && h <= 23) return h + m / 60;
  }

  // "4pm", "9 am", "at 4 p.m."
  const meridiem = t.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (meridiem?.[1]) {
    let h = parseInt(meridiem[1], 10) % 12;
    if (/p/.test(meridiem[2] ?? "")) h += 12;
    return h;
  }

  // bare "at 4" / "around 9"
  const bare = t.match(/\b(?:at|around|by|@)\s*(\d{1,2})\b/);
  if (bare?.[1]) {
    const n = parseInt(bare[1], 10);
    if (n >= 0 && n <= 23) {
      // 1–7 with no qualifier almost always means afternoon/evening.
      if (n >= 1 && n <= 7) return n + 12;
      return n;
    }
  }

  return null;
}

export function parseAsk(text: string, day: Date): Ask {
  const durationMin = parseDurationMin(text);
  const startHour = parseStartHour(text);
  return {
    description: text.trim(),
    durationMin,
    proposedStart: startHour === null ? undefined : atHour(day, startHour),
  };
}
