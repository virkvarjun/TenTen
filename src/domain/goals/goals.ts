import type { Goal, GoalPacing } from "@/domain/types";

/**
 * Goal portfolio logic. Pure helpers for reasoning about how a goal is tracking
 * and which goals deserve the day's scarce peak hours.
 */

/** Fraction of the weekly target met so far (0–1+, can exceed 1 if ahead). */
export function progressFraction(goal: Goal): number {
  if (goal.targetHoursPerWeek <= 0) return 1;
  return goal.progressHours / goal.targetHoursPerWeek;
}

/**
 * Expected fraction of the weekly target that "should" be done by now, given
 * how far through the week we are (0–1). Lets pacing account for the calendar,
 * not just raw progress.
 */
export function pacingFor(goal: Goal, weekFraction = currentWeekFractionFallback()): GoalPacing {
  const expected = clamp01(weekFraction);
  const actual = progressFraction(goal);
  // A small tolerance band so we don't flip-flop around the line.
  if (actual >= expected + 0.1) return "ahead";
  if (actual <= expected - 0.1) return "behind";
  return "on-track";
}

/** How many hours this goal is behind its expected pace (0 if on/ahead). */
export function hoursBehind(goal: Goal, weekFraction = currentWeekFractionFallback()): number {
  const expectedHours = goal.targetHoursPerWeek * clamp01(weekFraction);
  return Math.max(0, expectedHours - goal.progressHours);
}

/**
 * Priority score used to contend for peak hours: weight, boosted when a goal is
 * behind its pace. Higher wins.
 */
export function contentionScore(goal: Goal, weekFraction = currentWeekFractionFallback()): number {
  const behind = hoursBehind(goal, weekFraction);
  return goal.weight * (1 + behind * 0.25);
}

/** Active goals sorted by who most deserves the day's best hours. */
export function rankByContention(goals: Goal[], weekFraction?: number): Goal[] {
  return goals
    .filter((g) => g.status === "active")
    .slice()
    .sort((a, b) => contentionScore(b, weekFraction) - contentionScore(a, weekFraction));
}

/** A rough per-day target derived from the weekly target across a 5-day week. */
export function dailyTargetHours(goal: Goal): number {
  return goal.targetHoursPerWeek / 5;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Fallback used when no week fraction is supplied. Domain logic must not read
 * the wall clock, so this is a neutral mid-week assumption; callers that care
 * pass a real fraction in.
 */
function currentWeekFractionFallback(): number {
  return 0.5;
}
