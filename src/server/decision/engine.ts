import "server-only";
import type { Decision, DecisionContext } from "@/domain/types";
import { heuristicDecision } from "@/domain/decision-engine";

/**
 * The decision-engine factory — the load-bearing seam.
 *
 * Phase 2 always returns the deterministic heuristic engine. Phase 3 adds an
 * LLM-backed engine and picks it when `ANTHROPIC_API_KEY` is present, falling
 * back here on any failure. Callers depend only on this function, never on a
 * concrete engine, so the swap is invisible to them.
 */
export async function decide(context: DecisionContext): Promise<Decision> {
  return heuristicDecision(context);
}
