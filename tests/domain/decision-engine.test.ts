import { describe, it, expect } from "vitest";
import type { Block, DecisionContext, Goal, Verdict } from "@/domain/types";
import { defaultEnergyProfile, peakHour } from "@/domain/energy/energy";
import { createBudget, allocateDeepWork } from "@/domain/budget/budget";
import { heuristicDecision, inferAskType } from "@/domain/decision-engine";
import { atHour } from "@/domain/time";

const DAY = new Date(2026, 5, 28);
const energy = defaultEnergyProfile("neutral");
const peak = peakHour(energy);

/** A behind-target deep goal that owns the morning peak. */
const behindDeepGoal: Goal = {
  id: "ship",
  title: "Ship v1",
  weight: 9,
  type: "deep",
  targetHoursPerWeek: 12,
  progressHours: 1, // far behind
  status: "active",
};

function context(overrides: Partial<DecisionContext>): DecisionContext {
  return {
    goals: [behindDeepGoal],
    energy,
    budget: createBudget(5),
    calendar: [],
    ask: { description: "Run with a friend", durationMin: 45, proposedStart: atHour(DAY, 16) },
    ...overrides,
  };
}

describe("inferAskType", () => {
  it("classifies physical activity as health", () => {
    expect(inferAskType("Raj wants to run at 4")).toBe("health");
    expect(inferAskType("gym session")).toBe("health");
  });
  it("defaults conversational asks to social", () => {
    expect(inferAskType("coffee with Sam")).toBe("social");
  });
});

describe("heuristic decision engine — table-driven", () => {
  const cases: Array<{ name: string; ctx: DecisionContext; expect: Verdict[] }> = [
    {
      name: "CANONICAL: run at 4 (trough) while a behind deep goal owns the morning peak → accept",
      ctx: context({
        ask: { description: "run at 4", durationMin: 45, proposedStart: atHour(DAY, 16) },
      }),
      expect: ["accept"],
    },
    {
      name: "coffee at the peak hour while a deep goal is behind → defer to a better slot",
      ctx: context({
        ask: { description: "coffee", durationMin: 60, proposedStart: atHour(DAY, peak) },
      }),
      expect: ["defer"],
    },
    {
      name: "no time given → engine finds the cheapest slot → accept",
      ctx: context({ ask: { description: "quick walk", durationMin: 30 } }),
      expect: ["accept"],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const d = heuristicDecision(c.ctx);
      expect(c.expect).toContain(d.verdict);
      expect(d.rationale.length).toBeGreaterThan(0);
      // Rationale references energy/goal state in plain language.
      expect(d.rationale.toLowerCase()).toMatch(/peak|dip|energy|quiet|budget|goal|behind|focus/);
    });
  }

  it("defers a peak ask with a concrete better slot", () => {
    const d = heuristicDecision(
      context({
        ask: { description: "coffee", durationMin: 60, proposedStart: atHour(DAY, peak) },
      }),
    );
    expect(d.verdict).toBe("defer");
    expect(d.suggestedSlot).toBeDefined();
  });

  it("declines when every slot collides with an immovable commitment", () => {
    const fullDay: Block[] = [];
    for (let h = 6; h < 23; h++) {
      fullDay.push({
        id: `busy-${h}`,
        start: atHour(DAY, h),
        end: atHour(DAY, h + 1),
        type: "shallow",
        source: "fixed",
        energyMatchScore: 0,
      });
    }
    const d = heuristicDecision(
      context({ calendar: fullDay, ask: { description: "lunch", durationMin: 60 } }),
    );
    expect(d.verdict).toBe("decline");
  });

  it("shares the Decision shape regardless of verdict", () => {
    const d = heuristicDecision(context({}));
    expect(Array.isArray(d.displaces)).toBe(true);
    expect(typeof d.rationale).toBe("string");
  });

  it("notes when the deep-work budget is already spent", () => {
    const spent = allocateDeepWork(createBudget(4), 4).budget;
    const d = heuristicDecision(
      context({ budget: spent, ask: { description: "easy walk", durationMin: 30 } }),
    );
    expect(d.verdict).toBe("accept");
  });
});
