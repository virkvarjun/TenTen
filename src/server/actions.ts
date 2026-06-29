"use server";

import { revalidatePath } from "next/cache";
import type { Ask, Decision, DecisionContext, Goal, WorkType } from "@/domain/types";
import { hasAnthropic } from "@/lib/env";
import { decide } from "@/server/decision/engine";
import {
  acceptAsk as acceptAskInStore,
  createGoal,
  declineAsk as declineAskInStore,
  deleteGoal,
  getSnapshot,
  recordAsk,
  recordCheckIn,
  resetStore,
  undoAsk as undoAskInStore,
  updateGoal,
  type GoalInput,
} from "@/server/store";
import { parseAsk } from "@/server/ask-parser";
import type { AskRecord } from "@/server/types";

/**
 * Thin server actions. They translate UI intent into store mutations and engine
 * calls, then revalidate. All real logic lives in the domain and the store.
 */

function refreshAll(): void {
  revalidatePath("/today");
  revalidatePath("/goals");
  revalidatePath("/heartbeat");
  revalidatePath("/events");
}

// --- Goals ---------------------------------------------------------------

export async function addGoalAction(input: GoalInput): Promise<void> {
  createGoal(input);
  refreshAll();
}

export async function updateGoalAction(
  id: string,
  patch: Partial<Omit<Goal, "id">>,
): Promise<void> {
  updateGoal(id, patch);
  refreshAll();
}

export async function deleteGoalAction(id: string): Promise<void> {
  deleteGoal(id);
  refreshAll();
}

// --- Heartbeat -----------------------------------------------------------

export async function checkInAction(input: {
  actualType: WorkType;
  note?: string;
  plannedBlockId?: string;
}): Promise<void> {
  recordCheckIn(input);
  refreshAll();
}

// --- Events / decision engine -------------------------------------------

export interface SubmitAskResult {
  recordId: string;
  decision: Decision;
  engine: "heuristic" | "llm";
  parsed: Ask;
}

/**
 * Parse a natural-language ask, run it through the decision engine, store the
 * result, and return it for the UI to render.
 */
export async function submitAskAction(text: string): Promise<SubmitAskResult> {
  const snapshot = getSnapshot();
  const parsed = parseAsk(text, snapshot.day);

  const context: DecisionContext = {
    goals: snapshot.goals,
    energy: snapshot.energy,
    budget: snapshot.budget,
    calendar: snapshot.blocks,
    ask: parsed,
  };

  const decision = await decide(context);
  const engine: "heuristic" | "llm" = hasAnthropic() ? "llm" : "heuristic";

  const record: AskRecord = {
    id: `ask-${Date.now().toString(36)}`,
    ask: parsed,
    decision,
    status:
      decision.verdict === "accept"
        ? "pending"
        : decision.verdict === "defer"
          ? "deferred"
          : "declined",
    engine,
    createdAt: new Date(),
  };
  recordAsk(record);
  refreshAll();
  return { recordId: record.id, decision, engine, parsed };
}

export async function acceptAskAction(askId: string): Promise<void> {
  acceptAskInStore(askId);
  refreshAll();
}

export async function undoAskAction(askId: string): Promise<void> {
  undoAskInStore(askId);
  refreshAll();
}

export async function declineAskAction(askId: string): Promise<void> {
  declineAskInStore(askId);
  refreshAll();
}

// --- Demo ----------------------------------------------------------------

export async function resetDemoAction(): Promise<void> {
  resetStore();
  refreshAll();
}
