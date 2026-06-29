import type { DecisionContext, Goal, WorkType } from "@/domain/types";
import { defaultEnergyProfile, peakHour } from "@/domain/energy/energy";
import { createBudget } from "@/domain/budget/budget";
import { atHour } from "@/domain/time";

/**
 * Test fixtures / factories.
 *
 * Integration tests run against the in-memory store seeded by `seedDay`
 * (src/server/mock/seed.ts) — no live database is required, so CI needs no
 * disposable Postgres. The Prisma schema is validated by `prisma generate` in
 * CI; data-access against a real DB is exercised once persistence is switched on.
 */

export const TEST_DAY = new Date(2026, 5, 28);
export const testEnergy = defaultEnergyProfile("neutral");

export function makeGoal(overrides: Partial<Goal> & Pick<Goal, "id" | "type">): Goal {
  return {
    title: overrides.id,
    weight: 8,
    targetHoursPerWeek: 10,
    progressHours: 0,
    status: "active",
    ...overrides,
  };
}

/** A behind-target deep goal that owns the morning peak. */
export const behindDeepGoal: Goal = makeGoal({
  id: "ship",
  title: "Ship v1",
  type: "deep",
  weight: 9,
  targetHoursPerWeek: 12,
  progressHours: 1,
});

export function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    goals: [behindDeepGoal],
    energy: testEnergy,
    budget: createBudget(5),
    calendar: [],
    ask: { description: "run at 4", durationMin: 45, proposedStart: atHour(TEST_DAY, 16) },
    ...overrides,
  };
}

export function peakHourFor(type: WorkType = "deep"): number {
  void type;
  return peakHour(testEnergy);
}
