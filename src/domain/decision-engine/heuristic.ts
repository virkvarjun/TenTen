import type {
  Block,
  Decision,
  DecisionContext,
  EnergyProfile,
  Slot,
  WorkType,
} from "@/domain/types";
import { energyAt } from "@/domain/energy/energy";
import { remainingHours } from "@/domain/budget/budget";
import { hoursBehind, rankByContention } from "@/domain/goals/goals";
import { atHour, hourOf, overlaps, startOfDay } from "@/domain/time";
import { freeWindows } from "@/domain/scheduler/scheduler";

/**
 * The deterministic heuristic decision engine.
 *
 * Given the portfolio, the energy curve, the remaining budget, the day's blocks,
 * and an incoming ask, it returns a verdict + a better slot + what it displaces +
 * a plain-language rationale that references energy and goal state.
 *
 * Rules:
 * - ACCEPT if the ask serves a low-cost moment: it lands in a trough or genuine
 *   free time and doesn't rob a peak a behind-target deep goal needs.
 * - DEFER (with a better slot) if it would burn a peak that deep work needs.
 * - DECLINE if commitments leave no workable slot at all.
 *
 * This shares the exact `DecisionEngine` signature with the Phase 3 LLM engine,
 * so the two are drop-in swappable.
 */

const PEAK_THRESHOLD = 0.7;
const TROUGH_THRESHOLD = 0.45;

/** Infer the kind of activity an ask represents from its wording. */
export function inferAskType(description: string): WorkType {
  const text = description.toLowerCase();
  const health = [
    "run",
    "gym",
    "lift",
    "workout",
    "work out",
    "walk",
    "yoga",
    "climb",
    "swim",
    "ride",
    "bike",
  ];
  const deep = ["deep work", "focus", "write", "code", "design review", "study"];
  if (health.some((w) => text.includes(w))) return "health";
  if (deep.some((w) => text.includes(w))) return "deep";
  return "social";
}

function referenceDay(context: DecisionContext): Date {
  const anchor = context.ask.proposedStart ?? context.calendar[0]?.start;
  return startOfDay(anchor ?? new Date(0));
}

function asSlot(day: Date, startHour: number, durHours: number): Slot {
  return { start: atHour(day, startHour), end: atHour(day, startHour + durHours) };
}

/** Best free slot for the given duration, preferring low-energy (trough) hours. */
function bestTroughSlot(
  context: DecisionContext,
  durHours: number,
): { startHour: number; energy: number } | null {
  const windows = freeWindows(context.calendar);
  let best: { startHour: number; energy: number } | null = null;
  for (const w of windows) {
    for (let start = w.start; start + durHours <= w.end + 1e-9; start++) {
      const e = meanEnergy(context.energy, start, durHours);
      if (best === null || e < best.energy) best = { startHour: start, energy: e };
    }
  }
  return best;
}

function meanEnergy(energy: EnergyProfile, startHour: number, durHours: number): number {
  const span = Math.max(1, Math.round(durHours));
  let sum = 0;
  for (let h = Math.floor(startHour); h < Math.floor(startHour) + span; h++)
    sum += energyAt(energy, h);
  return sum / span;
}

function collidesWithFixed(context: DecisionContext, start: Date, end: Date): Block | null {
  for (const block of context.calendar) {
    if (block.source === "fixed" && overlaps(start, end, block.start, block.end)) return block;
  }
  return null;
}

function displacedPlanned(context: DecisionContext, start: Date, end: Date): Block[] {
  return context.calendar.filter(
    (b) => b.source === "planned" && overlaps(start, end, b.start, b.end),
  );
}

function fmtHour(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

export function heuristicDecision(context: DecisionContext): Decision {
  const { ask, energy, budget } = context;
  const day = referenceDay(context);
  const durHours = Math.max(0.25, ask.durationMin / 60);
  const askType = inferAskType(ask.description);

  // The behind-target deep goals whose peak hours we must protect.
  const behindDeep = rankByContention(context.goals)
    .filter((g) => g.type === "deep")
    .filter((g) => hoursBehind(g) > 0);
  const protectingPeak = behindDeep.length > 0;
  const topGoal = behindDeep[0];

  // --- Case A: the ask names a specific time. ---
  if (ask.proposedStart) {
    const startHour = hourOf(ask.proposedStart);
    const start = ask.proposedStart;
    const end = atHour(day, startHour + durHours);
    const energyHere = meanEnergy(energy, startHour, durHours);

    const fixedClash = collidesWithFixed(context, start, end);
    if (fixedClash) {
      const alt = bestTroughSlot(context, durHours);
      if (!alt) {
        return decline(
          `${fmtHour(startHour)} collides with “${labelFor(fixedClash)}”, and there's no free ${durHours.toFixed(
            0,
          )}h window left in the day to move it to.`,
        );
      }
      return defer(
        asSlot(day, alt.startHour, durHours),
        `${fmtHour(startHour)} runs straight into “${labelFor(
          fixedClash,
        )}”. ${fmtHour(alt.startHour)} is open and sits in a lower-energy stretch — a cleaner fit.`,
      );
    }

    const inPeak = energyHere >= PEAK_THRESHOLD;
    if (inPeak && protectingPeak) {
      const alt = bestTroughSlot(context, durHours);
      const goalName = topGoal ? `“${topGoal.title}”` : "your top deep goal";
      if (alt && alt.energy < energyHere) {
        return defer(
          asSlot(day, alt.startHour, durHours),
          `${fmtHour(startHour)} is one of your peak hours, and ${goalName} is ${hoursBehind(
            topGoal!,
          ).toFixed(1)}h behind pace — that focus time is too valuable to spend here. ${fmtHour(
            alt.startHour,
          )} falls in your dip, where this fits without costing you anything.`,
        );
      }
      return defer(
        asSlot(day, startHour, durHours),
        `${fmtHour(startHour)} is a peak hour ${goalName} needs. If it has to be now, protect tomorrow's morning for deep work.`,
      );
    }

    // Trough or genuine free time — cheap to say yes.
    const displaces = displacedPlanned(context, start, end);
    const energyWord = energyHere <= TROUGH_THRESHOLD ? "post-peak dip" : "a quiet stretch";
    return accept(
      asSlot(day, startHour, durHours),
      displaces.map((b) => b.id),
      `${fmtHour(startHour)} sits in ${energyWord}, so a ${askType} block costs you no focus time${
        displaces.length ? `, only a movable ${displaces.map(labelFor).join(", ")}` : ""
      }. Easy yes.`,
    );
  }

  // --- Case B: no specific time — find the cheapest slot ourselves. ---
  const slot = bestTroughSlot(context, durHours);
  if (!slot) {
    return decline(
      `Your day is fully committed — there's no open ${durHours.toFixed(
        0,
      )}h window for this without displacing protected work. Worth pushing to tomorrow.`,
    );
  }
  const budgetNote =
    remainingHours(budget) <= 0
      ? " Your deep-work budget is already spent for today, so a recovery-friendly block like this is exactly right."
      : "";
  return accept(
    asSlot(day, slot.startHour, durHours),
    [],
    `${fmtHour(slot.startHour)} is your lowest-energy open window — the natural home for a ${askType} block that doesn't compete with focus work.${budgetNote}`,
  );
}

function labelFor(block: Block): string {
  return block.goalId ? block.goalId.replace(/^.*?-/, "") : block.type;
}

function accept(suggestedSlot: Slot, displaces: string[], rationale: string): Decision {
  return { verdict: "accept", suggestedSlot, displaces, rationale };
}
function defer(suggestedSlot: Slot, rationale: string): Decision {
  return { verdict: "defer", suggestedSlot, displaces: [], rationale };
}
function decline(rationale: string): Decision {
  return { verdict: "decline", displaces: [], rationale };
}
