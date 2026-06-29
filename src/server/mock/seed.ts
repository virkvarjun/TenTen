import type { Block, CheckIn, DeepWorkBudget, EnergyProfile, Goal } from "@/domain/types";
import { defaultEnergyProfile } from "@/domain/energy/energy";
import { createBudget } from "@/domain/budget/budget";
import { buildSchedule } from "@/domain/scheduler/scheduler";
import { atHour, startOfDay } from "@/domain/time";

/**
 * The seeded demo. A realistic user: six goals across every type, a neutral
 * chronotype curve (morning peak, post-lunch dip, softer evening peak), a 5-hour
 * deep-work budget, and a half-planned day with two fixed commitments.
 *
 * Phase 2 reads this into an in-memory store. Phase 3 migrates the same shapes
 * into Postgres.
 */

export const DEMO_USER_ID = "demo-user";

/**
 * How far through the week the demo is pinned at. Used consistently by the
 * scheduler and the pacing display so "behind/on-track/ahead" lines up with how
 * the day was laid out.
 */
export const DEMO_WEEK_FRACTION = 0.4;

export function seedGoals(): Goal[] {
  return [
    {
      id: "goal-ship",
      title: "Ship Meridian v1",
      weight: 9,
      type: "deep",
      targetHoursPerWeek: 12,
      progressHours: 4,
      status: "active",
    },
    {
      id: "goal-essays",
      title: "Write the essay series",
      weight: 7,
      type: "deep",
      targetHoursPerWeek: 6,
      progressHours: 1,
      status: "active",
    },
    {
      id: "goal-reading",
      title: "Reading & research",
      weight: 5,
      type: "shallow",
      targetHoursPerWeek: 5,
      progressHours: 2,
      status: "active",
    },
    {
      id: "goal-ops",
      title: "Inbox & ops",
      weight: 4,
      type: "admin",
      targetHoursPerWeek: 5,
      progressHours: 3,
      status: "active",
    },
    {
      id: "goal-marathon",
      title: "Marathon training",
      weight: 6,
      type: "health",
      targetHoursPerWeek: 5,
      progressHours: 2,
      status: "active",
    },
    {
      id: "goal-people",
      title: "Friends & family",
      weight: 6,
      type: "social",
      targetHoursPerWeek: 4,
      progressHours: 1,
      status: "active",
    },
  ];
}

export function seedEnergy(): EnergyProfile {
  return defaultEnergyProfile("neutral");
}

export function seedBudget(): DeepWorkBudget {
  return createBudget(5);
}

/** The day's immovable commitments. */
export function seedFixedBlocks(day: Date): Block[] {
  return [
    {
      id: "fixed-commute",
      start: atHour(day, 8),
      end: atHour(day, 9),
      type: "admin",
      source: "fixed",
      energyMatchScore: 0.4,
    },
    {
      id: "fixed-standup",
      start: atHour(day, 13),
      end: atHour(day, 14),
      type: "shallow",
      source: "fixed",
      energyMatchScore: 0.5,
    },
  ];
}

/** A couple of check-ins from earlier in the day, feeding the heartbeat view. */
export function seedCheckIns(day: Date): CheckIn[] {
  return [
    {
      id: "checkin-1",
      timestamp: atHour(day, 9.5),
      plannedBlockId: undefined,
      actualType: "deep",
      note: "Deep on the scheduler module.",
    },
    {
      id: "checkin-2",
      timestamp: atHour(day, 11),
      plannedBlockId: undefined,
      actualType: "deep",
    },
  ];
}

export interface SeededDay {
  day: Date;
  goals: Goal[];
  energy: EnergyProfile;
  budget: DeepWorkBudget;
  blocks: Block[];
  checkIns: CheckIn[];
}

/**
 * Build a complete seeded day for `referenceDay`. Lays planned blocks onto the
 * energy curve via the real scheduler, so the demo reflects the actual engine.
 */
export function seedDay(referenceDay: Date): SeededDay {
  const day = startOfDay(referenceDay);
  const goals = seedGoals();
  const energy = seedEnergy();
  const budget = seedBudget();
  const fixedBlocks = seedFixedBlocks(day);

  const { plannedBlocks, budget: budgetAfter } = buildSchedule({
    day,
    goals,
    energy,
    budget,
    fixedBlocks,
    weekFraction: DEMO_WEEK_FRACTION,
  });

  return {
    day,
    goals,
    energy,
    budget: budgetAfter,
    blocks: [...fixedBlocks, ...plannedBlocks],
    checkIns: seedCheckIns(day),
  };
}
