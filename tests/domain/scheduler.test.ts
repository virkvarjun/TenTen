import { describe, it, expect } from "vitest";
import type { Block, Goal } from "@/domain/types";
import { defaultEnergyProfile, peakHour } from "@/domain/energy/energy";
import { createBudget } from "@/domain/budget/budget";
import { buildSchedule } from "@/domain/scheduler/scheduler";
import { atHour, hourOf, overlaps } from "@/domain/time";

const DAY = new Date(2026, 5, 28);
const energy = defaultEnergyProfile("neutral");

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "type">): Goal {
  return {
    title: partial.id,
    weight: 8,
    targetHoursPerWeek: 10,
    progressHours: 0,
    status: "active",
    ...partial,
  };
}

describe("scheduler", () => {
  it("lands deep work near the energy peak", () => {
    const result = buildSchedule({
      day: DAY,
      goals: [goal({ id: "deep", type: "deep", targetHoursPerWeek: 8 })],
      energy,
      budget: createBudget(5),
      fixedBlocks: [],
    });
    const deep = result.plannedBlocks.find((b) => b.type === "deep");
    expect(deep).toBeDefined();
    const start = hourOf(deep!.start);
    expect(Math.abs(start - peakHour(energy))).toBeLessThanOrEqual(2);
  });

  it("routes admin away from the peak (into lower energy)", () => {
    const result = buildSchedule({
      day: DAY,
      goals: [goal({ id: "ops", type: "admin", targetHoursPerWeek: 5, weight: 4 })],
      energy,
      budget: createBudget(5),
      fixedBlocks: [],
    });
    const admin = result.plannedBlocks.find((b) => b.type === "admin");
    expect(admin).toBeDefined();
    expect(Math.abs(hourOf(admin!.start) - peakHour(energy))).toBeGreaterThan(1);
  });

  it("never overlaps a fixed block", () => {
    const fixed: Block = {
      id: "fixed-mtg",
      start: atHour(DAY, peakHour(energy)),
      end: atHour(DAY, peakHour(energy) + 1),
      type: "shallow",
      source: "fixed",
      energyMatchScore: 0,
    };
    const result = buildSchedule({
      day: DAY,
      goals: [goal({ id: "deep", type: "deep", targetHoursPerWeek: 8 })],
      energy,
      budget: createBudget(5),
      fixedBlocks: [fixed],
    });
    for (const b of result.plannedBlocks) {
      expect(overlaps(b.start, b.end, fixed.start, fixed.end)).toBe(false);
    }
  });

  it("stops scheduling deep work once the budget is spent", () => {
    const result = buildSchedule({
      day: DAY,
      goals: [
        goal({ id: "d1", type: "deep", targetHoursPerWeek: 20, weight: 9 }),
        goal({ id: "d2", type: "deep", targetHoursPerWeek: 20, weight: 8 }),
        goal({ id: "d3", type: "deep", targetHoursPerWeek: 20, weight: 7 }),
      ],
      energy,
      budget: createBudget(4),
      fixedBlocks: [],
    });
    expect(result.budget.allocatedHours).toBeLessThanOrEqual(4);
  });
});
