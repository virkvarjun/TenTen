/**
 * Canonical Meridian domain vocabulary.
 *
 * This file is the single source of truth for the shapes the domain logic
 * operates on. It is framework-agnostic: no Next.js, React, or Prisma imports
 * belong here. Persistence types (Phase 3) map onto these, not the other way
 * around.
 */

/** The kind of work a goal or block represents. Drives energy matching. */
export type WorkType = "deep" | "shallow" | "admin" | "health" | "social";

/** Whether a goal is currently being pursued. */
export type GoalStatus = "active" | "paused" | "archived";

/** How a goal is tracking against its weekly target. */
export type GoalPacing = "behind" | "on-track" | "ahead";

/**
 * Something the user is pursuing. The portfolio of goals is the app's source of
 * truth for "what matters."
 */
export interface Goal {
  id: string;
  title: string;
  /** Relative priority. Higher wins contention for peak hours. */
  weight: number;
  type: WorkType;
  targetHoursPerWeek: number;
  /** Hours logged against this goal so far this week. */
  progressHours: number;
  status: GoalStatus;
}

/**
 * A per-user curve of hourly energy scores (0–1) across the 24-hour day.
 * Starts from a chronotype default, then learns from behaviour.
 */
export interface EnergyProfile {
  chronotype: Chronotype;
  /** Exactly 24 entries, index = hour of day (0–23), value 0–1. */
  hourlyScores: number[];
}

export type Chronotype = "lark" | "neutral" | "owl";

/**
 * A daily ceiling of focus hours. Deep-type work draws this down; when spent,
 * the app stops scheduling focus work and routes to shallow/recovery.
 */
export interface DeepWorkBudget {
  /** Daily ceiling, clamped to 4–6. */
  dailyCeilingHours: number;
  /** Deep-work hours already allocated/spent today. */
  allocatedHours: number;
}

/** Where a block came from. */
export type BlockSource = "planned" | "fixed";

/** A scheduled span on the timeline. Goal-linked or fixed (meeting, commute). */
export interface Block {
  id: string;
  start: Date;
  end: Date;
  type: WorkType;
  goalId?: string;
  source: BlockSource;
  /** How well this block's type fits the energy at its hour (0–1). */
  energyMatchScore: number;
}

/** The verdict the decision engine returns for an incoming ask. */
export type Verdict = "accept" | "defer" | "decline";

/** An incoming ask the user wants a decision on ("a friend wants to run at 4"). */
export interface Ask {
  description: string;
  proposedStart?: Date;
  durationMin: number;
}

/** A proposed time window for an accepted/deferred ask. */
export interface Slot {
  start: Date;
  end: Date;
}

/**
 * The decision engine's output. The heuristic (Phase 2) and LLM (Phase 3)
 * engines share this exact shape so they are drop-in swappable.
 */
export interface Decision {
  verdict: Verdict;
  suggestedSlot?: Slot;
  /** Block ids this decision would displace, if accepted. */
  displaces: string[];
  /** Plain-language reasoning referencing energy + goal state. */
  rationale: string;
}

/** Everything the decision engine reasons over. */
export interface DecisionContext {
  goals: Goal[];
  energy: EnergyProfile;
  budget: DeepWorkBudget;
  /** The day's blocks (fixed commitments + currently planned work). */
  calendar: Block[];
  ask: Ask;
}

/** The shared contract both decision engines implement. */
export type DecisionEngine = (context: DecisionContext) => Promise<Decision> | Decision;

/** A low-friction interval ping recording what actually happened vs. the plan. */
export interface CheckIn {
  id: string;
  timestamp: Date;
  plannedBlockId?: string;
  actualType: WorkType;
  note?: string;
}
