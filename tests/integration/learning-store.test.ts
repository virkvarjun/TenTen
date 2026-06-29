import { describe, it, expect, beforeEach } from "vitest";
import {
  createGoal,
  deleteGoal,
  getSnapshot,
  resetStore,
  runLearning,
  updateGoal,
} from "@/server/store";

beforeEach(() => {
  resetStore();
});

describe("learning loop over the store", () => {
  it("drifts the energy curve conservatively from the day's check-ins", () => {
    const before = [...getSnapshot().energy.hourlyScores];
    const result = runLearning(new Date(2026, 5, 28, 23, 0));
    expect(result.ran).toBe(true);
    expect(result.signals).toBeGreaterThan(0);
    const after = getSnapshot().energy.hourlyScores;
    // Something moved, but the whole curve stays bounded.
    expect(after).not.toEqual(before);
    for (const s of after) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("is idempotent — re-running the same day is a no-op", () => {
    const now = new Date(2026, 5, 28, 23, 0);
    runLearning(now);
    const afterFirst = [...getSnapshot().energy.hourlyScores];
    const second = runLearning(now);
    expect(second.ran).toBe(false);
    expect(getSnapshot().energy.hourlyScores).toEqual(afterFirst);
  });
});

describe("goal CRUD over the store", () => {
  it("creates, updates, and deletes goals, replanning each time", () => {
    const created = createGoal({
      title: "New deep goal",
      weight: 8,
      type: "deep",
      targetHoursPerWeek: 6,
    });
    expect(getSnapshot().goals.some((g) => g.id === created.id)).toBe(true);

    updateGoal(created.id, { progressHours: 3 });
    expect(getSnapshot().goals.find((g) => g.id === created.id)!.progressHours).toBe(3);

    expect(deleteGoal(created.id)).toBe(true);
    expect(getSnapshot().goals.some((g) => g.id === created.id)).toBe(false);
  });

  it("keeps the planned schedule within the deep-work budget after edits", () => {
    createGoal({ title: "Greedy deep", weight: 10, type: "deep", targetHoursPerWeek: 40 });
    const { budget } = getSnapshot();
    expect(budget.allocatedHours).toBeLessThanOrEqual(budget.dailyCeilingHours);
  });
});
