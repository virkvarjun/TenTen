import type { Chronotype, EnergyProfile, WorkType } from "@/domain/types";

/**
 * Energy modelling.
 *
 * The energy model is a per-user curve of 24 hourly scores (0–1). Day one it
 * comes from a chronotype default; the learning loop (Phase 3) nudges it from
 * behaviour. Everything here is pure and deterministic.
 */

export const HOURS_IN_DAY = 24;

/** The hours we are willing to schedule work into. Outside this is recovery. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 23;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Chronotype default curves. Index = hour of day (0–23), value = energy (0–1).
 * Each has a characteristic morning ramp, a post-lunch dip, and an evening
 * profile that distinguishes the type.
 */
const CHRONOTYPE_CURVES: Record<Chronotype, readonly number[]> = {
  // Early peak, strong mornings, fading evenings.
  lark: [
    0.08, 0.06, 0.05, 0.05, 0.08, 0.2, 0.45, 0.7, 0.9, 0.97, 0.92, 0.8, 0.6, 0.45, 0.4, 0.45, 0.5,
    0.5, 0.45, 0.4, 0.3, 0.2, 0.12, 0.1,
  ],
  // Morning peak, clear post-lunch dip, softer evening peak.
  neutral: [
    0.1, 0.08, 0.06, 0.05, 0.05, 0.1, 0.25, 0.45, 0.65, 0.85, 0.95, 0.9, 0.7, 0.5, 0.4, 0.45, 0.55,
    0.65, 0.7, 0.6, 0.5, 0.4, 0.25, 0.15,
  ],
  // Slow start, afternoon climb, strong evening peak.
  owl: [
    0.3, 0.2, 0.12, 0.08, 0.06, 0.06, 0.1, 0.2, 0.35, 0.5, 0.62, 0.7, 0.68, 0.6, 0.6, 0.68, 0.75,
    0.82, 0.9, 0.95, 0.9, 0.8, 0.6, 0.45,
  ],
};

/** Build a fresh EnergyProfile from a chronotype default. */
export function defaultEnergyProfile(chronotype: Chronotype): EnergyProfile {
  return {
    chronotype,
    hourlyScores: [...CHRONOTYPE_CURVES[chronotype]],
  };
}

/** Energy score (0–1) at a given hour. Hours outside 0–23 wrap defensively. */
export function energyAt(profile: EnergyProfile, hour: number): number {
  const idx = ((Math.floor(hour) % HOURS_IN_DAY) + HOURS_IN_DAY) % HOURS_IN_DAY;
  return profile.hourlyScores[idx] ?? 0;
}

/**
 * How well a block of `type` fits the energy at `hour`. Returns 0–1.
 *
 * The intuition the whole product rests on:
 * - deep work wants the peak (match rises with energy)
 * - admin wants the trough (match rises as energy falls — never burn a peak on it)
 * - shallow work is happiest in the middle
 * - health & social are flexible but lean away from the peak so they don't
 *   displace deep work from the hours only deep work can use
 */
export function energyMatchScore(type: WorkType, hour: number, profile: EnergyProfile): number {
  const e = energyAt(profile, hour);
  switch (type) {
    case "deep":
      return clamp01(e);
    case "admin":
      return clamp01(1 - e);
    case "shallow":
      return clamp01(1 - Math.abs(e - 0.5) * 1.4);
    case "health":
      return clamp01(0.95 - e * 0.4);
    case "social":
      return clamp01(0.9 - e * 0.35);
  }
}

export interface EnergyWindow {
  startHour: number;
  /** Exclusive end hour. */
  endHour: number;
  /** Mean energy across the window. */
  meanEnergy: number;
}

function windowsByPredicate(
  profile: EnergyProfile,
  predicate: (energy: number) => boolean,
): EnergyWindow[] {
  const windows: EnergyWindow[] = [];
  let start: number | null = null;
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour++) {
    const inWindow = hour < DAY_END_HOUR && predicate(energyAt(profile, hour));
    if (inWindow && start === null) {
      start = hour;
    } else if (!inWindow && start !== null) {
      windows.push(makeWindow(profile, start, hour));
      start = null;
    }
  }
  if (start !== null) windows.push(makeWindow(profile, start, DAY_END_HOUR));
  return windows;
}

function makeWindow(profile: EnergyProfile, startHour: number, endHour: number): EnergyWindow {
  let sum = 0;
  for (let h = startHour; h < endHour; h++) sum += energyAt(profile, h);
  const span = Math.max(1, endHour - startHour);
  return { startHour, endHour, meanEnergy: sum / span };
}

/** Contiguous peak windows (energy at or above `threshold`), highest first. */
export function findPeakWindows(profile: EnergyProfile, threshold = 0.7): EnergyWindow[] {
  return windowsByPredicate(profile, (e) => e >= threshold).sort(
    (a, b) => b.meanEnergy - a.meanEnergy,
  );
}

/** Contiguous trough windows (energy at or below `threshold`), lowest first. */
export function findTroughWindows(profile: EnergyProfile, threshold = 0.45): EnergyWindow[] {
  return windowsByPredicate(profile, (e) => e <= threshold).sort(
    (a, b) => a.meanEnergy - b.meanEnergy,
  );
}

/** The single highest-energy hour inside the working day. */
export function peakHour(profile: EnergyProfile): number {
  let best = DAY_START_HOUR;
  let bestEnergy = -1;
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    const e = energyAt(profile, h);
    if (e > bestEnergy) {
      bestEnergy = e;
      best = h;
    }
  }
  return best;
}
