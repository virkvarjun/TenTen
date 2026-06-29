import { describe, it, expect } from "vitest";
import type { Decision, DecisionContext } from "@/domain/types";

/**
 * A smoke test proving the test harness runs and the domain type seam is
 * importable from tests. Real domain logic + its tests arrive in Phase 2.
 */
describe("scaffold", () => {
  it("exposes the decision engine contract shape", () => {
    const decision: Decision = {
      verdict: "defer",
      displaces: [],
      rationale: "Placeholder until the Phase 2 engine lands.",
    };
    expect(decision.verdict).toBe("defer");
    expect(decision.displaces).toEqual([]);
  });

  it("models the decision context vocabulary", () => {
    const context: Pick<DecisionContext, "ask"> = {
      ask: { description: "Run with a friend at 4", durationMin: 45 },
    };
    expect(context.ask.durationMin).toBe(45);
  });
});
