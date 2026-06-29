import type { Ask, Block, CheckIn, Decision, EnergyProfile, Goal, DeepWorkBudget } from "@/domain/types";

/** A submitted ask plus the engine's decision and the user's response to it. */
export interface AskRecord {
  id: string;
  ask: Ask;
  decision: Decision;
  status: "pending" | "accepted" | "declined" | "deferred";
  /** Which engine produced the decision — surfaced in the UI. */
  engine: "heuristic" | "llm";
  createdAt: Date;
}

/** The full, denormalized view of a user's day that the surfaces render. */
export interface DaySnapshot {
  day: Date;
  energy: EnergyProfile;
  budget: DeepWorkBudget;
  goals: Goal[];
  /** Fixed commitments + accepted asks + generated planned blocks, sorted. */
  blocks: Block[];
  checkIns: CheckIn[];
  asks: AskRecord[];
}
