import type { CheckIn, EnergyProfile, Goal, WorkType } from "@/domain/types";
import { hourOf } from "@/domain/time";

/**
 * The learning loop (pure core).
 *
 * Nightly, Meridian nudges the energy curve toward the hours where focused work
 * actually happened, and tracks follow-through per goal. The updates are
 * deliberately conservative — exponential smoothing toward an observed value, so
 * the curve *drifts* over weeks rather than swinging on a single day.
 */

/** Default learning rate. Small on purpose: the curve should be slow to change. */
export const DEFAULT_LEARNING_RATE = 0.08;

/** How much "observed energy" each actual activity type implies at its hour. */
const OBSERVED_ENERGY: Record<WorkType, number> = {
  deep: 0.9,
  shallow: 0.55,
  admin: 0.4,
  health: 0.5,
  social: 0.5,
};

export interface EnergySignal {
  hour: number;
  observedEnergy: number;
}

/** Turn a day's check-ins into per-hour energy observations. */
export function signalsFromCheckIns(checkIns: CheckIn[]): EnergySignal[] {
  return checkIns.map((c) => ({
    hour: Math.floor(hourOf(c.timestamp)),
    observedEnergy: OBSERVED_ENERGY[c.actualType],
  }));
}

/**
 * Apply conservative learning to an energy profile. For each observed hour the
 * score moves a fraction `rate` of the way toward the observation. Never jumps;
 * always clamped to 0–1. Pure — returns a new profile.
 */
export function applyLearning(
  profile: EnergyProfile,
  signals: EnergySignal[],
  rate: number = DEFAULT_LEARNING_RATE,
): EnergyProfile {
  const hourly = [...profile.hourlyScores];

  // Average multiple observations for the same hour before nudging.
  const byHour = new Map<number, number[]>();
  for (const s of signals) {
    const hour = ((s.hour % 24) + 24) % 24;
    const list = byHour.get(hour) ?? [];
    list.push(s.observedEnergy);
    byHour.set(hour, list);
  }

  for (const [hour, observations] of byHour) {
    const mean = observations.reduce((a, b) => a + b, 0) / observations.length;
    const current = hourly[hour] ?? 0;
    hourly[hour] = clamp01(current + rate * (mean - current));
  }

  return { chronotype: profile.chronotype, hourlyScores: hourly };
}

export interface FollowThrough {
  total: number;
  onPlan: number;
  /** Fraction of check-ins that matched their planned block type (0–1). */
  rate: number;
}

/**
 * Follow-through: of the check-ins tied to a planned block, how many matched the
 * plan's type. A coarse but honest measure of "did the day go as intended".
 */
export function computeFollowThrough(
  checkIns: CheckIn[],
  plannedTypeByBlockId: Map<string, WorkType>,
): FollowThrough {
  const tied = checkIns.filter(
    (c) => c.plannedBlockId && plannedTypeByBlockId.has(c.plannedBlockId),
  );
  const onPlan = tied.filter(
    (c) => c.actualType === plannedTypeByBlockId.get(c.plannedBlockId!),
  ).length;
  const total = tied.length;
  return { total, onPlan, rate: total === 0 ? 1 : onPlan / total };
}

/** Per-goal completion vs. weekly target (0–1+). Feeds future scheduling weight. */
export function goalCompletion(goal: Goal): number {
  if (goal.targetHoursPerWeek <= 0) return 1;
  return goal.progressHours / goal.targetHoursPerWeek;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
