import { z } from "zod";

/**
 * The contract for decision-engine output. The heuristic engine produces this
 * shape directly; the Phase 3 LLM engine's raw output is validated against this
 * schema before it is ever allowed near the UI. Anything that doesn't parse is
 * rejected and triggers the heuristic fallback.
 */

export const verdictSchema = z.enum(["accept", "defer", "decline"]);

export const slotSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export const decisionSchema = z.object({
  verdict: verdictSchema,
  suggestedSlot: slotSchema.optional(),
  displaces: z.array(z.string()).default([]),
  rationale: z.string().min(1),
});

/**
 * The shape we ask the LLM to emit (hours as numbers, not Dates — easier for a
 * model to produce reliably). The server maps this onto the domain `Decision`.
 */
export const llmDecisionSchema = z.object({
  verdict: verdictSchema,
  suggestedSlot: z
    .object({
      startHour: z.number().min(0).max(24),
      endHour: z.number().min(0).max(24),
    })
    .optional(),
  displaces: z.array(z.string()).default([]),
  rationale: z.string().min(1),
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;
