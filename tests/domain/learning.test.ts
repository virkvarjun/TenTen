import { describe, it, expect } from "vitest";
import type { CheckIn } from "@/domain/types";
import { defaultEnergyProfile } from "@/domain/energy/energy";
import {
  applyLearning,
  computeFollowThrough,
  signalsFromCheckIns,
} from "@/domain/learning/learning";

function checkIn(hour: number, actualType: CheckIn["actualType"], id = `c-${hour}`): CheckIn {
  const ts = new Date(2026, 5, 28, hour, 0, 0);
  return { id, timestamp: ts, actualType };
}

describe("learning loop", () => {
  it("derives one energy signal per check-in", () => {
    const signals = signalsFromCheckIns([checkIn(9, "deep"), checkIn(14, "admin")]);
    expect(signals).toHaveLength(2);
    expect(signals[0]!.hour).toBe(9);
  });

  it("nudges the curve toward where deep work actually happened — conservatively", () => {
    const before = defaultEnergyProfile("neutral");
    const lowHour = 14; // post-lunch dip
    const baseline = before.hourlyScores[lowHour]!;
    const after = applyLearning(before, [{ hour: lowHour, observedEnergy: 0.9 }]);
    const updated = after.hourlyScores[lowHour]!;
    // Moved up, but not all the way (smooth drift, not a swing).
    expect(updated).toBeGreaterThan(baseline);
    expect(updated).toBeLessThan(0.9);
    expect(updated - baseline).toBeLessThan(0.2);
  });

  it("is pure — does not mutate the input profile", () => {
    const before = defaultEnergyProfile("neutral");
    const snapshot = [...before.hourlyScores];
    applyLearning(before, [{ hour: 10, observedEnergy: 0.1 }]);
    expect(before.hourlyScores).toEqual(snapshot);
  });

  it("converges (re-running drifts further but stays bounded 0–1)", () => {
    let p = defaultEnergyProfile("neutral");
    for (let i = 0; i < 50; i++) {
      p = applyLearning(p, [{ hour: 3, observedEnergy: 1 }]);
    }
    expect(p.hourlyScores[3]!).toBeLessThanOrEqual(1);
    expect(p.hourlyScores[3]!).toBeGreaterThan(0.9);
  });

  it("computes follow-through against planned block types", () => {
    const planned = new Map([["b1", "deep" as const]]);
    const onPlan: CheckIn = { ...checkIn(9, "deep"), plannedBlockId: "b1" };
    const offPlan: CheckIn = { ...checkIn(10, "social", "c2"), plannedBlockId: "b1" };
    expect(computeFollowThrough([onPlan], planned).rate).toBe(1);
    expect(computeFollowThrough([onPlan, offPlan], planned).rate).toBe(0.5);
  });
});
