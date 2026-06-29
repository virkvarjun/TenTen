import type { DeepWorkBudget } from "@/domain/types";

/**
 * Deep-work budget logic.
 *
 * The budget is a hard daily ceiling on focus hours (default 5, clamped 4–6).
 * Deep work draws it down. The single most important rule in this file: we
 * refuse to allocate deep work past the ceiling — that refusal is a product
 * feature, not a bug.
 */

export const DEFAULT_CEILING_HOURS = 5;
export const MIN_CEILING_HOURS = 4;
export const MAX_CEILING_HOURS = 6;

/** Clamp a requested ceiling into the allowed 4–6 hour range. */
export function clampCeiling(hours: number): number {
  if (Number.isNaN(hours)) return DEFAULT_CEILING_HOURS;
  return Math.min(MAX_CEILING_HOURS, Math.max(MIN_CEILING_HOURS, hours));
}

/** Build a budget with a clamped ceiling and nothing allocated yet. */
export function createBudget(dailyCeilingHours = DEFAULT_CEILING_HOURS): DeepWorkBudget {
  return { dailyCeilingHours: clampCeiling(dailyCeilingHours), allocatedHours: 0 };
}

/** Focus hours still available today. Never negative. */
export function remainingHours(budget: DeepWorkBudget): number {
  return Math.max(0, budget.dailyCeilingHours - budget.allocatedHours);
}

/** Fraction of the ceiling already spent (0–1, clamped). */
export function utilization(budget: DeepWorkBudget): number {
  if (budget.dailyCeilingHours <= 0) return 1;
  return Math.min(1, Math.max(0, budget.allocatedHours / budget.dailyCeilingHours));
}

/** True once allocation meets or exceeds the ceiling. */
export function isExhausted(budget: DeepWorkBudget): boolean {
  return remainingHours(budget) <= 0;
}

/** True if allocation has somehow run past the ceiling (an invariant violation). */
export function isOverBudget(budget: DeepWorkBudget): boolean {
  return budget.allocatedHours > budget.dailyCeilingHours;
}

/** Whether `hours` of deep work can be allocated without breaching the ceiling. */
export function canAllocateDeep(budget: DeepWorkBudget, hours: number): boolean {
  return hours > 0 && hours <= remainingHours(budget) + 1e-9;
}

export interface AllocationResult {
  ok: boolean;
  budget: DeepWorkBudget;
  /** Hours actually allocated (0 when refused). */
  allocated: number;
  reason?: string;
}

/**
 * Allocate deep-work hours against the budget. Pure: returns a new budget and
 * never mutates the input. Refuses (ok: false) rather than overspending.
 */
export function allocateDeepWork(budget: DeepWorkBudget, hours: number): AllocationResult {
  if (hours <= 0) {
    return { ok: false, budget, allocated: 0, reason: "Nothing to allocate." };
  }
  if (!canAllocateDeep(budget, hours)) {
    return {
      ok: false,
      budget,
      allocated: 0,
      reason: `Deep-work budget exhausted: ${remainingHours(budget).toFixed(
        1,
      )}h left, ${hours.toFixed(1)}h requested.`,
    };
  }
  return {
    ok: true,
    budget: { ...budget, allocatedHours: budget.allocatedHours + hours },
    allocated: hours,
  };
}
