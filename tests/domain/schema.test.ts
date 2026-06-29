import { describe, it, expect } from "vitest";
import { decisionSchema, llmDecisionSchema } from "@/domain/decision-engine";

describe("LLM decision schema", () => {
  it("accepts a well-formed decision", () => {
    const parsed = llmDecisionSchema.parse({
      verdict: "defer",
      suggestedSlot: { startHour: 16, endHour: 16.75 },
      displaces: [],
      rationale: "4pm sits in your dip; the peak is reserved for a behind deep goal.",
    });
    expect(parsed.verdict).toBe("defer");
  });

  it("defaults displaces to an empty array", () => {
    const parsed = llmDecisionSchema.parse({ verdict: "accept", rationale: "ok" });
    expect(parsed.displaces).toEqual([]);
  });

  it("REJECTS an invalid verdict", () => {
    expect(() => llmDecisionSchema.parse({ verdict: "maybe", rationale: "x" })).toThrow();
  });

  it("REJECTS an empty rationale", () => {
    expect(() => llmDecisionSchema.parse({ verdict: "accept", rationale: "" })).toThrow();
  });

  it("REJECTS an out-of-range hour", () => {
    expect(() =>
      llmDecisionSchema.parse({
        verdict: "defer",
        suggestedSlot: { startHour: 30, endHour: 31 },
        rationale: "x",
      }),
    ).toThrow();
  });

  it("REJECTS garbage / non-object input", () => {
    expect(() => llmDecisionSchema.parse("not json")).toThrow();
    expect(() => llmDecisionSchema.parse(null)).toThrow();
  });

  it("decisionSchema coerces slot dates", () => {
    const parsed = decisionSchema.parse({
      verdict: "accept",
      suggestedSlot: { start: "2026-06-28T16:00:00.000Z", end: "2026-06-28T16:45:00.000Z" },
      displaces: [],
      rationale: "ok",
    });
    expect(parsed.suggestedSlot?.start).toBeInstanceOf(Date);
  });
});
