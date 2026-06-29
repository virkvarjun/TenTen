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
import { buildSchedule } from "@/domain/scheduler/scheduler";
import { createBudget } from "@/domain/budget/budget";
import { atHour, hourOf, startOfDay } from "@/domain/time";
import { seedDay } from "@/server/mock/seed";
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
    weekFraction: 0.4,
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
