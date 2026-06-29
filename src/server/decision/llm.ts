import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Decision, DecisionContext } from "@/domain/types";
import { llmDecisionSchema, type LlmDecision } from "@/domain/decision-engine";
import { energyAt, DAY_END_HOUR, DAY_START_HOUR } from "@/domain/energy/energy";
import { remainingHours } from "@/domain/budget/budget";
import { hoursBehind, pacingFor } from "@/domain/goals/goals";
import { atHour, hourOf, startOfDay } from "@/domain/time";
import { freeWindows } from "@/domain/scheduler/scheduler";
import { env } from "@/lib/env";

/**
 * The LLM-backed decision engine.
 *
 * It shares the `Decision` contract with the heuristic engine, so the factory
 * can swap them freely. The model does the *reasoning*; the arithmetic
 * (free/busy windows, remaining budget, energy at each hour) is computed here in
 * code and handed to it as facts. Output is constrained to JSON and validated
 * with Zod — unvalidated model output never reaches the UI. On any failure the
 * caller (the factory) falls back to the heuristic engine.
 */

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are the decision engine inside Meridian, an energy-aware productivity tool.
You decide whether an incoming ask should be ACCEPTED, DEFERRED to a better time, or DECLINED.

Reason about three things at once:
- The user's GOAL PORTFOLIO (weights, types, how far behind pace each is).
- The user's ENERGY CURVE across the day (deep/focus work belongs on peaks; low-cost social/health belongs in troughs).
- The remaining DEEP-WORK BUDGET (a hard daily ceiling on focus hours).

Principles:
- Protect peak hours for behind-target deep goals. Never spend a peak on something that fits a trough.
- Accept freely when an ask lands in a low-energy window or genuine free time and costs no focus work.
- Defer (don't decline) when there's a better slot — name it.
- Decline only when commitments leave no workable slot.

Return ONLY a JSON object, no prose, no markdown fences, matching exactly:
{"verdict":"accept"|"defer"|"decline","suggestedSlot":{"startHour":<0-24 number>,"endHour":<0-24 number>}|null,"displaces":[<block id strings>],"rationale":"<one or two sentences in plain language that reference the user's energy and goal state>"}`;

interface Snapshot {
  workingHours: { start: number; end: number };
  energyByHour: Record<number, number>;
  goals: Array<{
    title: string;
    type: string;
    weight: number;
    targetHoursPerWeek: number;
    progressHours: number;
    pacing: string;
    hoursBehind: number;
  }>;
  remainingDeepBudgetHours: number;
  fixedBlocks: Array<{ id: string; startHour: number; endHour: number; type: string }>;
  freeWindows: Array<{ startHour: number; endHour: number }>;
  ask: { description: string; proposedStartHour: number | null; durationHours: number };
}

function buildSnapshot(context: DecisionContext): Snapshot {
  const energyByHour: Record<number, number> = {};
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    energyByHour[h] = Math.round(energyAt(context.energy, h) * 100) / 100;
  }
  return {
    workingHours: { start: DAY_START_HOUR, end: DAY_END_HOUR },
    energyByHour,
    goals: context.goals
      .filter((g) => g.status === "active")
      .map((g) => ({
        title: g.title,
        type: g.type,
        weight: g.weight,
        targetHoursPerWeek: g.targetHoursPerWeek,
        progressHours: g.progressHours,
        pacing: pacingFor(g),
        hoursBehind: Math.round(hoursBehind(g) * 10) / 10,
      })),
    remainingDeepBudgetHours: remainingHours(context.budget),
    fixedBlocks: context.calendar
      .filter((b) => b.source === "fixed")
      .map((b) => ({
        id: b.id,
        startHour: hourOf(b.start),
        endHour: hourOf(b.end),
        type: b.type,
      })),
    freeWindows: freeWindows(context.calendar).map((w) => ({ startHour: w.start, endHour: w.end })),
    ask: {
      description: context.ask.description,
      proposedStartHour: context.ask.proposedStart ? hourOf(context.ask.proposedStart) : null,
      durationHours: Math.round((context.ask.durationMin / 60) * 100) / 100,
    },
  };
}

function referenceDay(context: DecisionContext): Date {
  const anchor = context.ask.proposedStart ?? context.calendar[0]?.start;
  return startOfDay(anchor ?? new Date());
}

/** Parse the model's text into a validated LlmDecision, or throw. */
function parseDecision(text: string): LlmDecision {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output.");
  const json: unknown = JSON.parse(cleaned.slice(start, end + 1));
  return llmDecisionSchema.parse(json);
}

function toDecision(parsed: LlmDecision, day: Date): Decision {
  return {
    verdict: parsed.verdict,
    suggestedSlot: parsed.suggestedSlot
      ? {
          start: atHour(day, parsed.suggestedSlot.startHour),
          end: atHour(day, parsed.suggestedSlot.endHour),
        }
      : undefined,
    displaces: parsed.displaces,
    rationale: parsed.rationale,
  };
}

/**
 * Run the ask through Claude. Throws on missing key, API error, or invalid
 * output after one retry — the factory catches and falls back to heuristic.
 */
export async function llmDecision(context: DecisionContext): Promise<Decision> {
  const apiKey = env.anthropicApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey });
  const snapshot = buildSnapshot(context);
  const day = referenceDay(context);
  const userPrompt = `Here is the current state and the incoming ask:\n\n${JSON.stringify(
    snapshot,
    null,
    2,
  )}\n\nReturn your decision as JSON.`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return toDecision(parseDecision(text), day);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM decision failed.");
}
