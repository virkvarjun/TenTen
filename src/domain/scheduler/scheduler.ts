import type { Block, DeepWorkBudget, EnergyProfile, Goal, WorkType } from "@/domain/types";
import { DAY_END_HOUR, DAY_START_HOUR, energyMatchScore, energyAt } from "@/domain/energy/energy";
import { allocateDeepWork, remainingHours } from "@/domain/budget/budget";
import { dailyTargetHours, rankByContention } from "@/domain/goals/goals";
import { atHour, hourOf } from "@/domain/time";

/**
 * The day-layout engine.
 *
 * Given the goal portfolio, the energy curve, the deep-work budget, and the
 * day's fixed commitments, it lays out a suggested day: deep work onto peaks,
 * shallow/admin into troughs, health/social into whatever flexible space is
 * left. Fixed blocks are immovable and never overlapped. Deep work stops the
 * moment the budget is spent.
 *
 * Pure: no wall-clock reads, no mutation of inputs.
 */

export interface ScheduleInput {
  day: Date;
  goals: Goal[];
  energy: EnergyProfile;
  budget: DeepWorkBudget;
  /** Immovable commitments (meetings, commute) that must be respected. */
  fixedBlocks: Block[];
  /** Week progress 0–1, used for goal pacing. Defaults to mid-week. */
  weekFraction?: number;
}

export interface ScheduleResult {
  /** The newly planned, goal-linked blocks. */
  plannedBlocks: Block[];
  /** Budget after deep-work allocation. */
  budget: DeepWorkBudget;
  /** Goals that wanted time but could not be placed (no fit / no budget). */
  unplaced: Goal[];
}

const MIN_BLOCK_HOURS = 1;
const MAX_BLOCK_HOURS = 3;

/** Mark which whole hours in the working day are already occupied by fixed blocks. */
function occupiedHours(fixedBlocks: Block[]): Set<number> {
  const occupied = new Set<number>();
  for (const block of fixedBlocks) {
    const start = Math.floor(hourOf(block.start));
    const end = Math.ceil(hourOf(block.end));
    for (let h = start; h < end; h++) occupied.add(h);
  }
  return occupied;
}

/** All maximal runs of free whole-hours within the working day. */
function freeRuns(occupied: Set<number>): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const free = h < DAY_END_HOUR && !occupied.has(h);
    if (free && start === null) start = h;
    else if (!free && start !== null) {
      runs.push({ start, end: h });
      start = null;
    }
  }
  if (start !== null) runs.push({ start, end: DAY_END_HOUR });
  return runs;
}

/**
 * Pick the best placement (start hour + length) for a goal of `type` needing
 * `desiredHours`, given current free runs. Ranks candidate placements by mean
 * energy-match for the type. Returns null if nothing fits.
 */
function bestPlacement(
  type: WorkType,
  desiredHours: number,
  runs: Array<{ start: number; end: number }>,
  energy: EnergyProfile,
): { start: number; length: number } | null {
  const length = Math.max(MIN_BLOCK_HOURS, Math.min(MAX_BLOCK_HOURS, Math.round(desiredHours)));
  let best: { start: number; length: number; score: number } | null = null;

  for (const run of runs) {
    const runLength = run.end - run.start;
    if (runLength < MIN_BLOCK_HOURS) continue;
    const placeLength = Math.min(length, runLength);
    for (let start = run.start; start + placeLength <= run.end; start++) {
      let score = 0;
      for (let h = start; h < start + placeLength; h++) score += energyMatchScore(type, h, energy);
      score /= placeLength;
      if (best === null || score > best.score) best = { start, length: placeLength, score };
    }
  }
  return best ? { start: best.start, length: best.length } : null;
}

/** Lay out a suggested day. */
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const { day, goals, energy, fixedBlocks, weekFraction } = input;
  let budget = input.budget;

  const occupied = occupiedHours(fixedBlocks);
  const plannedBlocks: Block[] = [];
  const unplaced: Goal[] = [];

  // Deep goals contend for peaks in priority order; everything else fills in
  // after, so flexible work never steals an hour deep work could have used.
  const ranked = rankByContention(goals, weekFraction);
  const deepGoals = ranked.filter((g) => g.type === "deep");
  const otherGoals = ranked.filter((g) => g.type !== "deep");

  for (const goal of [...deepGoals, ...otherGoals]) {
    const desired = Math.max(MIN_BLOCK_HOURS, dailyTargetHours(goal));

    // Deep work is gated by the budget; flexible work is gated only by space.
    let hoursToPlace = desired;
    if (goal.type === "deep") {
      const left = remainingHours(budget);
      if (left < MIN_BLOCK_HOURS) {
        unplaced.push(goal);
        continue;
      }
      hoursToPlace = Math.min(desired, left);
    }

    const runs = freeRuns(occupied);
    const placement = bestPlacement(goal.type, hoursToPlace, runs, energy);
    if (!placement) {
      unplaced.push(goal);
      continue;
    }

    if (goal.type === "deep") {
      const result = allocateDeepWork(budget, placement.length);
      if (!result.ok) {
        unplaced.push(goal);
        continue;
      }
      budget = result.budget;
    }

    const start = atHour(day, placement.start);
    const end = atHour(day, placement.start + placement.length);
    plannedBlocks.push({
      id: `planned-${goal.id}-${placement.start}`,
      start,
      end,
      type: goal.type,
      goalId: goal.id,
      source: "planned",
      energyMatchScore: round2(meanMatch(goal.type, placement, energy)),
    });
    for (let h = placement.start; h < placement.start + placement.length; h++) occupied.add(h);
  }

  return { plannedBlocks, budget, unplaced };
}

function meanMatch(
  type: WorkType,
  placement: { start: number; length: number },
  energy: EnergyProfile,
): number {
  let sum = 0;
  for (let h = placement.start; h < placement.start + placement.length; h++) {
    sum += energyMatchScore(type, h, energy);
  }
  return sum / placement.length;
}

/** Annotate any block with its energy-match score for its type at its hour. */
export function scoreBlock(block: Block, energy: EnergyProfile): number {
  const start = Math.floor(hourOf(block.start));
  const end = Math.max(start + 1, Math.ceil(hourOf(block.end)));
  let sum = 0;
  for (let h = start; h < end; h++) sum += energyMatchScore(block.type, h, energy);
  return round2(sum / (end - start));
}

/** Free whole-hour windows in the working day, as {start,end} hour pairs. */
export function freeWindows(fixedBlocks: Block[]): Array<{ start: number; end: number }> {
  return freeRuns(occupiedHours(fixedBlocks));
}

/** Mean energy across a candidate slot — handy for ranking ask slots. */
export function slotEnergy(energy: EnergyProfile, startHour: number, endHour: number): number {
  let sum = 0;
  const span = Math.max(1, Math.ceil(endHour) - Math.floor(startHour));
  for (let h = Math.floor(startHour); h < Math.floor(startHour) + span; h++) {
    sum += energyAt(energy, h);
  }
  return sum / span;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
