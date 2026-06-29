import "server-only";
import type { Decision, DecisionContext } from "@/domain/types";
import { heuristicDecision } from "@/domain/decision-engine";
import { hasAnthropic } from "@/lib/env";
import { llmDecision } from "./llm";

/**
 * The decision-engine factory — the load-bearing seam.
 *
 * If `ANTHROPIC_API_KEY` is present we use the LLM engine; on any failure
 * (missing key, API error, invalid/unvalidated output after a retry) we fall
 * back to the deterministic heuristic engine and log a clear warning. The app
 * therefore always returns a sensible decision, with or without a key.
 *
 * Callers depend only on `decide()`, never on a concrete engine.
 */
export async function decide(context: DecisionContext): Promise<Decision> {
  if (!hasAnthropic()) {
    return heuristicDecision(context);
  }
  try {
    return await llmDecision(context);
  } catch (error) {
    console.warn(
      "[decision-engine] LLM engine failed; falling back to heuristic:",
      error instanceof Error ? error.message : error,
    );
    return heuristicDecision(context);
  }
}

/** Which engine `decide()` would use right now — surfaced in the UI. */
export function activeEngine(): "heuristic" | "llm" {
  return hasAnthropic() ? "llm" : "heuristic";
}
