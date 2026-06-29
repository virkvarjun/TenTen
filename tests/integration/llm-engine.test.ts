import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DecisionContext, Goal } from "@/domain/types";
import { defaultEnergyProfile, peakHour } from "@/domain/energy/energy";
import { createBudget } from "@/domain/budget/budget";
import { atHour } from "@/domain/time";

// Mock the Anthropic SDK. `create` is swapped per-test.
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const DAY = new Date(2026, 5, 28);
const energy = defaultEnergyProfile("neutral");

const goal: Goal = {
  id: "ship",
  title: "Ship v1",
  weight: 9,
  type: "deep",
  targetHoursPerWeek: 12,
  progressHours: 1,
  status: "active",
};

function context(): DecisionContext {
  return {
    goals: [goal],
    energy,
    budget: createBudget(5),
    calendar: [],
    ask: { description: "coffee", durationMin: 60, proposedStart: atHour(DAY, peakHour(energy)) },
  };
}

function textResponse(body: string) {
  return { content: [{ type: "text", text: body }] };
}

beforeEach(() => {
  create.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("decide() factory with Anthropic mocked", () => {
  it("returns the LLM verdict when the model emits valid JSON", async () => {
    create.mockResolvedValue(
      textResponse(
        JSON.stringify({
          verdict: "defer",
          suggestedSlot: { startHour: 16, endHour: 17 },
          displaces: [],
          rationale: "That hour is a peak your deep goal needs; 4pm is a cheaper slot.",
        }),
      ),
    );
    const { decide } = await import("@/server/decision/engine");
    const d = await decide(context());
    expect(d.verdict).toBe("defer");
    expect(d.suggestedSlot).toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("tolerates JSON wrapped in markdown fences", async () => {
    create.mockResolvedValue(
      textResponse("```json\n" + JSON.stringify({ verdict: "accept", rationale: "ok" }) + "\n```"),
    );
    const { decide } = await import("@/server/decision/engine");
    const d = await decide(context());
    expect(d.verdict).toBe("accept");
  });

  it("retries once on garbage, then falls back to the heuristic engine", async () => {
    create.mockResolvedValue(textResponse("not json at all"));
    const { decide } = await import("@/server/decision/engine");
    const d = await decide(context());
    // Two attempts inside llmDecision, then heuristic fallback.
    expect(create).toHaveBeenCalledTimes(2);
    expect(["accept", "defer", "decline"]).toContain(d.verdict);
    expect(d.rationale.length).toBeGreaterThan(0);
  });

  it("never surfaces unvalidated output (invalid shape → fallback)", async () => {
    // Valid JSON but violates the schema (bad verdict, missing rationale).
    create.mockResolvedValue(textResponse(JSON.stringify({ verdict: "perhaps" })));
    const { decide } = await import("@/server/decision/engine");
    const d = await decide(context());
    expect(["accept", "defer", "decline"]).toContain(d.verdict);
  });

  it("falls back to heuristic immediately when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { decide } = await import("@/server/decision/engine");
    const d = await decide(context());
    expect(create).not.toHaveBeenCalled();
    expect(["accept", "defer", "decline"]).toContain(d.verdict);
  });
});
