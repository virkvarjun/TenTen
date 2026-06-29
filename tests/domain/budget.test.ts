import { describe, it, expect } from "vitest";
import {
  allocateDeepWork,
  canAllocateDeep,
  clampCeiling,
  createBudget,
  isExhausted,
  MAX_CEILING_HOURS,
  MIN_CEILING_HOURS,
  remainingHours,
} from "@/domain/budget/budget";

describe("budget ceiling", () => {
  it("clamps the ceiling to 4–6 hours", () => {
    expect(clampCeiling(2)).toBe(MIN_CEILING_HOURS);
    expect(clampCeiling(10)).toBe(MAX_CEILING_HOURS);
    expect(clampCeiling(5)).toBe(5);
    expect(clampCeiling(NaN)).toBe(5);
  });

  it("creates a budget with a clamped ceiling and nothing allocated", () => {
    const b = createBudget(9);
    expect(b.dailyCeilingHours).toBe(MAX_CEILING_HOURS);
    expect(b.allocatedHours).toBe(0);
  });
});

describe("allocation", () => {
  it("reports remaining hours, never negative", () => {
    const b = { dailyCeilingHours: 5, allocatedHours: 4 };
    expect(remainingHours(b)).toBe(1);
    expect(remainingHours({ dailyCeilingHours: 5, allocatedHours: 9 })).toBe(0);
  });

  it("allocates within the ceiling and returns a new budget (pure)", () => {
    const b = createBudget(5);
    const res = allocateDeepWork(b, 2);
    expect(res.ok).toBe(true);
    expect(res.budget.allocatedHours).toBe(2);
    expect(b.allocatedHours).toBe(0); // input untouched
  });

  it("HARD REFUSAL: never allocates deep work past the ceiling", () => {
    const b = { dailyCeilingHours: 5, allocatedHours: 4 };
    expect(canAllocateDeep(b, 2)).toBe(false);
    const res = allocateDeepWork(b, 2);
    expect(res.ok).toBe(false);
    expect(res.allocated).toBe(0);
    expect(res.budget.allocatedHours).toBe(4); // unchanged
    expect(res.reason).toMatch(/exhausted/i);
  });

  it("marks the budget exhausted once spent", () => {
    expect(isExhausted({ dailyCeilingHours: 5, allocatedHours: 5 })).toBe(true);
    expect(isExhausted({ dailyCeilingHours: 5, allocatedHours: 3 })).toBe(false);
  });

  it("refuses zero or negative allocations", () => {
    expect(allocateDeepWork(createBudget(5), 0).ok).toBe(false);
    expect(allocateDeepWork(createBudget(5), -1).ok).toBe(false);
  });
});
