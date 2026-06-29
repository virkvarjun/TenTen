import "server-only";
import type { Block, WorkType } from "@/domain/types";
import { startOfDay } from "@/domain/time";

/**
 * Google Calendar integration via the Calendar REST API (no extra SDK).
 *
 * Reads the day's events as fixed blocks the scheduler must respect, writes
 * accepted asks as events (only after explicit in-app confirmation — enforced by
 * the caller), and deletes them again for undo. Every function degrades
 * gracefully: with no access token, reads return an empty list and writes report
 * "not connected" rather than throwing.
 */

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";

export interface CalendarResult<T> {
  ok: boolean;
  data?: T;
  reason?: string;
}

/** Infer a work type for an external event from its title. */
function inferType(summary: string): WorkType {
  const t = summary.toLowerCase();
  if (/run|gym|walk|workout|yoga|swim|ride|bike|climb|lift/.test(t)) return "health";
  if (/coffee|lunch|dinner|drinks|catch up|1:1|sync|social/.test(t)) return "social";
  return "admin";
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Fetch the day's timed events and map them to fixed timeline blocks. */
export async function listEventsForDay(
  accessToken: string | undefined,
  day: Date,
): Promise<CalendarResult<Block[]>> {
  if (!accessToken) return { ok: false, reason: "Calendar not connected.", data: [] };

  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const url = new URL(`${CAL_BASE}/events`);
  url.searchParams.set("timeMin", dayStart.toISOString());
  url.searchParams.set("timeMax", dayEnd.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return { ok: false, reason: `Calendar read failed (${res.status}).`, data: [] };
    const body: { items?: GoogleEvent[] } = await res.json();
    const blocks: Block[] = (body.items ?? [])
      .filter((e) => e.start?.dateTime && e.end?.dateTime)
      .map((e) => {
        const summary = e.summary ?? "Busy";
        return {
          id: `gcal-${e.id}`,
          start: new Date(e.start!.dateTime!),
          end: new Date(e.end!.dateTime!),
          type: inferType(summary),
          source: "fixed" as const,
          energyMatchScore: 0,
        };
      });
    return { ok: true, data: blocks };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Calendar read error.",
      data: [],
    };
  }
}

export interface CalendarWrite {
  summary: string;
  start: Date;
  end: Date;
}

/**
 * Write an event to the user's primary calendar. The caller must have obtained
 * explicit in-app confirmation first — this function never gates on its own.
 * Returns the created event id for later undo.
 */
export async function insertEvent(
  accessToken: string | undefined,
  event: CalendarWrite,
): Promise<CalendarResult<{ eventId: string }>> {
  if (!accessToken) return { ok: false, reason: "Calendar not connected." };
  try {
    const res = await fetch(`${CAL_BASE}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    });
    if (!res.ok) return { ok: false, reason: `Calendar write failed (${res.status}).` };
    const body: { id: string } = await res.json();
    return { ok: true, data: { eventId: body.id } };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Calendar write error." };
  }
}

/** Delete a previously-written event — the in-app undo for a calendar write. */
export async function deleteEvent(
  accessToken: string | undefined,
  eventId: string,
): Promise<CalendarResult<null>> {
  if (!accessToken) return { ok: false, reason: "Calendar not connected." };
  try {
    const res = await fetch(`${CAL_BASE}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 410) {
      return { ok: false, reason: `Calendar delete failed (${res.status}).` };
    }
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Calendar delete error." };
  }
}
