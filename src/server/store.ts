import "server-only";
import type {
  Ask,
  Block,
  CheckIn,
  DeepWorkBudget,
  EnergyProfile,
  Goal,
  WorkType,
} from "@/domain/types";
import type { Chronotype } from "@/domain/types";
import { buildSchedule } from "@/domain/scheduler/scheduler";
import { createBudget, clampCeiling } from "@/domain/budget/budget";
import { defaultEnergyProfile } from "@/domain/energy/energy";
import { applyLearning, signalsFromCheckIns } from "@/domain/learning/learning";
import { atHour, hourOf, startOfDay } from "@/domain/time";
import { seedDay, DEMO_WEEK_FRACTION } from "@/server/mock/seed";
import type { AskRecord, DaySnapshot } from "@/server/types";

/**
 * The in-memory day store for Phase 2. A single mutable state object, seeded on
 * first access and kept across hot reloads via globalThis. No external calls.
 *
 * Phase 3 replaces this module with a Prisma-backed data-access layer exposing
 * the same functions, so the surfaces don't change.
 */

interface DayState {
  day: Date;
  energy: EnergyProfile;
  ceilingHours: number;
  goals: Goal[];
  /** Immovable commitments + accepted asks. */
  fixedBlocks: Block[];
  /** Generated, goal-linked blocks. */
  plannedBlocks: Block[];
  budget: DeepWorkBudget;
  checkIns: CheckIn[];
  asks: AskRecord[];
  /** ISO date string of the last day the learning loop ran (for idempotency). */
  lastLearnedDay?: string;
  /** Whether onboarding has been completed. */
  onboarded: boolean;
}

const globalForStore = globalThis as unknown as { meridianStore?: DayState };

function init(): DayState {
  const seeded = seedDay(new Date());
  const fixedBlocks = seeded.blocks.filter((b) => b.source === "fixed");
  const plannedBlocks = seeded.blocks.filter((b) => b.source === "planned");
  return {
    day: seeded.day,
    energy: seeded.energy,
    ceilingHours: seeded.budget.dailyCeilingHours,
    goals: seeded.goals,
    fixedBlocks,
    plannedBlocks,
    budget: seeded.budget,
    checkIns: seeded.checkIns,
    asks: [],
    onboarded: true,
  };
}

function state(): DayState {
  if (!globalForStore.meridianStore) globalForStore.meridianStore = init();
  return globalForStore.meridianStore;
}

/** Recompute the planned (goal-linked) blocks and budget around fixed commitments. */
function replan(s: DayState): void {
  const { plannedBlocks, budget } = buildSchedule({
    day: s.day,
    goals: s.goals,
    energy: s.energy,
    budget: createBudget(s.ceilingHours),
    fixedBlocks: s.fixedBlocks,
    weekFraction: DEMO_WEEK_FRACTION,
  });
  s.plannedBlocks = plannedBlocks;
  s.budget = budget;
}

function sortedBlocks(s: DayState): Block[] {
  return [...s.fixedBlocks, ...s.plannedBlocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

/** The full snapshot the surfaces render. */
export function getSnapshot(): DaySnapshot {
  const s = state();
  return {
    day: s.day,
    energy: s.energy,
    budget: s.budget,
    goals: s.goals,
    blocks: sortedBlocks(s),
    checkIns: [...s.checkIns].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    asks: [...s.asks].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}

// --- Goals ---------------------------------------------------------------

export interface GoalInput {
  title: string;
  weight: number;
  type: WorkType;
  targetHoursPerWeek: number;
  progressHours?: number;
}

export function createGoal(input: GoalInput): Goal {
  const s = state();
  const goal: Goal = {
    id: `goal-${cryptoId()}`,
    title: input.title,
    weight: input.weight,
    type: input.type,
    targetHoursPerWeek: input.targetHoursPerWeek,
    progressHours: input.progressHours ?? 0,
    status: "active",
  };
  s.goals.push(goal);
  replan(s);
  return goal;
}

export function updateGoal(id: string, patch: Partial<Omit<Goal, "id">>): Goal | null {
  const s = state();
  const goal = s.goals.find((g) => g.id === id);
  if (!goal) return null;
  Object.assign(goal, patch);
  replan(s);
  return goal;
}

export function deleteGoal(id: string): boolean {
  const s = state();
  const before = s.goals.length;
  s.goals = s.goals.filter((g) => g.id !== id);
  if (s.goals.length === before) return false;
  replan(s);
  return true;
}

// --- Check-ins -----------------------------------------------------------

export function recordCheckIn(input: {
  actualType: WorkType;
  note?: string;
  plannedBlockId?: string;
}): CheckIn {
  const s = state();
  const checkIn: CheckIn = {
    id: `checkin-${cryptoId()}`,
    timestamp: new Date(),
    actualType: input.actualType,
    note: input.note,
    plannedBlockId: input.plannedBlockId,
  };
  s.checkIns.push(checkIn);
  return checkIn;
}

// --- Asks ----------------------------------------------------------------

export function recordAsk(record: AskRecord): void {
  state().asks.push(record);
}

/**
 * Accept a previously-decided ask: write its slot as a committed (fixed) block,
 * drop any planned blocks it displaces, and replan deep work around it.
 */
export function acceptAsk(askId: string): Block | null {
  const s = state();
  const record = s.asks.find((a) => a.id === askId);
  if (!record || !record.decision.suggestedSlot) return null;

  const slot = record.decision.suggestedSlot;
  const block: Block = {
    id: `ask-${askId}`,
    start: slot.start,
    end: slot.end,
    type: inferTypeFromAsk(record.ask),
    source: "fixed",
    energyMatchScore: 0,
  };
  s.fixedBlocks.push(block);
  record.status = "accepted";
  replan(s);
  return block;
}

/** Undo an accepted ask — remove its committed block and replan. */
export function undoAsk(askId: string): boolean {
  const s = state();
  const blockId = `ask-${askId}`;
  const before = s.fixedBlocks.length;
  s.fixedBlocks = s.fixedBlocks.filter((b) => b.id !== blockId);
  const record = s.asks.find((a) => a.id === askId);
  if (record) record.status = "pending";
  if (s.fixedBlocks.length === before) return false;
  replan(s);
  return true;
}

export function declineAsk(askId: string): void {
  const record = state().asks.find((a) => a.id === askId);
  if (record) record.status = "declined";
}

// --- Onboarding ----------------------------------------------------------

/** Begin a fresh onboarding: clear goals, blocks, and check-ins. */
export function beginOnboarding(): void {
  const s = state();
  s.goals = [];
  s.fixedBlocks = [];
  s.plannedBlocks = [];
  s.checkIns = [];
  s.asks = [];
  s.onboarded = false;
  s.budget = createBudget(s.ceilingHours);
}

/** Step 1: chronotype → seed the energy curve. */
export function onboardChronotype(chronotype: Chronotype): void {
  const s = state();
  s.energy = defaultEnergyProfile(chronotype);
  replan(s);
}

/** Step 2: deep-work ceiling (clamped 4–6). */
export function onboardCeiling(hours: number): void {
  const s = state();
  s.ceilingHours = clampCeiling(hours);
  replan(s);
}

/**
 * Step 3: goal portfolio, in priority order. Weight derives from order (first =
 * highest), so the drag-to-rank UI maps straight onto contention weight.
 */
export function onboardGoals(
  goals: Array<{ title: string; type: WorkType; targetHoursPerWeek: number }>,
): void {
  const s = state();
  s.goals = goals.map((g, i) => ({
    id: `goal-${cryptoId()}`,
    title: g.title,
    weight: Math.max(1, 10 - i),
    type: g.type,
    targetHoursPerWeek: g.targetHoursPerWeek,
    progressHours: 0,
    status: "active" as const,
  }));
  replan(s);
}

export interface WorkPattern {
  workStartHour: number;
  workEndHour: number;
  inOffice: boolean;
  commuteMinutes: number;
}

/**
 * Step 4: work + commute pattern. In-office days add commute as fixed blocks so
 * the scheduler protects peaks from being burned in transit.
 */
export function onboardWorkPattern(pattern: WorkPattern): void {
  const s = state();
  const day = s.day;
  s.fixedBlocks = s.fixedBlocks.filter((b) => !b.id.startsWith("commute-"));
  if (pattern.inOffice && pattern.commuteMinutes > 0) {
    const commuteHours = pattern.commuteMinutes / 60;
    s.fixedBlocks.push({
      id: "commute-morning",
      start: atHour(day, pattern.workStartHour - commuteHours),
      end: atHour(day, pattern.workStartHour),
      type: "admin",
      source: "fixed",
      energyMatchScore: 0,
    });
    s.fixedBlocks.push({
      id: "commute-evening",
      start: atHour(day, pattern.workEndHour),
      end: atHour(day, pattern.workEndHour + commuteHours),
      type: "admin",
      source: "fixed",
      energyMatchScore: 0,
    });
  }
  replan(s);
}

/** Finish onboarding. */
export function completeOnboarding(): void {
  state().onboarded = true;
}

export function isOnboarded(): boolean {
  return state().onboarded;
}

export interface LearningResult {
  ran: boolean;
  reason?: string;
  signals: number;
}

/**
 * The nightly learning step: nudge the energy curve toward the hours where
 * focused work actually happened today. Conservative (smooth) and idempotent —
 * running twice on the same day is a no-op.
 */
export function runLearning(now: Date = new Date()): LearningResult {
  const s = state();
  const today = startOfDay(now).toISOString();
  if (s.lastLearnedDay === today) {
    return { ran: false, reason: "Already learned today.", signals: 0 };
  }
  const signals = signalsFromCheckIns(s.checkIns);
  if (signals.length === 0) {
    s.lastLearnedDay = today;
    return { ran: false, reason: "No check-ins to learn from.", signals: 0 };
  }
  s.energy = applyLearning(s.energy, signals);
  s.lastLearnedDay = today;
  replan(s);
  return { ran: true, signals: signals.length };
}

/** Reset the store to the seeded state — used by the demo and tests. */
export function resetStore(): void {
  globalForStore.meridianStore = init();
}

function inferTypeFromAsk(ask: Ask): WorkType {
  const t = ask.description.toLowerCase();
  if (/run|gym|walk|workout|yoga|swim|ride|bike|climb|lift/.test(t)) return "health";
  return "social";
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Re-exported time helpers some server actions need without re-importing domain.
export const time = { atHour, hourOf, startOfDay };
