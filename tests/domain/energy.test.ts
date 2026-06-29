import { describe, it, expect } from "vitest";
import {
  defaultEnergyProfile,
  energyAt,
  energyMatchScore,
  findPeakWindows,
  findTroughWindows,
  peakHour,
} from "@/domain/energy/energy";

describe("energy profiles", () => {
  it("builds a 24-hour curve for each chronotype", () => {
    for (const c of ["lark", "neutral", "owl"] as const) {
      const p = defaultEnergyProfile(c);
      expect(p.chronotype).toBe(c);
      expect(p.hourlyScores).toHaveLength(24);
      for (const s of p.hourlyScores) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });

  it("larks peak earlier than owls", () => {
    expect(peakHour(defaultEnergyProfile("lark"))).toBeLessThan(
      peakHour(defaultEnergyProfile("owl")),
    );
  });

  it("wraps out-of-range hours defensively", () => {
    const p = defaultEnergyProfile("neutral");
    expect(energyAt(p, 24)).toBe(energyAt(p, 0));
    expect(energyAt(p, -1)).toBe(energyAt(p, 23));
  });
});

describe("energyMatchScore", () => {
  const neutral = defaultEnergyProfile("neutral");
  const peak = peakHour(neutral); // ~10am, high energy

  it("rewards deep work at the peak and punishes it in the trough", () => {
    const troughs = findTroughWindows(neutral);
    const troughHour = troughs[0]!.startHour;
    expect(energyMatchScore("deep", peak, neutral)).toBeGreaterThan(
      energyMatchScore("deep", troughHour, neutral),
    );
  });

  it("rewards admin in the trough, not the peak", () => {
    const troughs = findTroughWindows(neutral);
    const troughHour = troughs[0]!.startHour;
    expect(energyMatchScore("admin", troughHour, neutral)).toBeGreaterThan(
      energyMatchScore("admin", peak, neutral),
    );
  });

  it("keeps every score within 0–1", () => {
    for (const type of ["deep", "shallow", "admin", "health", "social"] as const) {
      for (let h = 0; h < 24; h++) {
        const s = energyMatchScore(type, h, neutral);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("peak/trough detection", () => {
  const neutral = defaultEnergyProfile("neutral");

  it("finds at least one peak window and ranks the strongest first", () => {
    const peaks = findPeakWindows(neutral);
    expect(peaks.length).toBeGreaterThan(0);
    if (peaks.length > 1) {
      expect(peaks[0]!.meanEnergy).toBeGreaterThanOrEqual(peaks[1]!.meanEnergy);
    }
  });

  it("finds trough windows below the threshold", () => {
    const troughs = findTroughWindows(neutral, 0.45);
    expect(troughs.length).toBeGreaterThan(0);
    for (const t of troughs) expect(t.meanEnergy).toBeLessThanOrEqual(0.46);
  });
});
