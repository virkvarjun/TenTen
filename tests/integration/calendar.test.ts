import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deleteEvent, insertEvent, listEventsForDay } from "@/server/calendar/google";

const DAY = new Date(2026, 5, 28);

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => impl(input.toString(), init));
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Calendar layer (fetch mocked)", () => {
  it("merges the day's events into fixed timeline blocks", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "evt1",
              summary: "Standup",
              start: { dateTime: new Date(2026, 5, 28, 9, 0).toISOString() },
              end: { dateTime: new Date(2026, 5, 28, 9, 30).toISOString() },
            },
            {
              id: "evt2",
              summary: "Run with Raj",
              start: { dateTime: new Date(2026, 5, 28, 16, 0).toISOString() },
              end: { dateTime: new Date(2026, 5, 28, 16, 45).toISOString() },
            },
          ],
        }),
      })),
    );

    const res = await listEventsForDay("token", DAY);
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.data!.every((b) => b.source === "fixed")).toBe(true);
    // "Run" is inferred as a health block.
    expect(res.data!.find((b) => b.id === "gcal-evt2")!.type).toBe("health");
  });

  it("returns an empty list (not an error throw) when not connected", async () => {
    const res = await listEventsForDay(undefined, DAY);
    expect(res.ok).toBe(false);
    expect(res.data).toEqual([]);
    expect(res.reason).toMatch(/not connected/i);
  });

  it("writes an event and returns its id for undo", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        expect(init?.method).toBe("POST");
        return { ok: true, status: 200, json: async () => ({ id: "created-123" }) };
      }),
    );
    const res = await insertEvent("token", {
      summary: "Run with Raj",
      start: new Date(2026, 5, 28, 16, 0),
      end: new Date(2026, 5, 28, 16, 45),
    });
    expect(res.ok).toBe(true);
    expect(res.data!.eventId).toBe("created-123");
  });

  it("undoes a write by deleting the event", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((_url, init) => {
        expect(init?.method).toBe("DELETE");
        return { ok: true, status: 204 };
      }),
    );
    const res = await deleteEvent("token", "created-123");
    expect(res.ok).toBe(true);
  });

  it("refuses to write when not connected", async () => {
    const res = await insertEvent(undefined, {
      summary: "x",
      start: DAY,
      end: DAY,
    });
    expect(res.ok).toBe(false);
  });
});
