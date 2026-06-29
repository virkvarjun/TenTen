import "server-only";
import type { Block, Goal, WorkType } from "@/domain/types";
import { hourOf } from "@/domain/time";
import { DAY_END_HOUR, DAY_START_HOUR } from "@/domain/energy/energy";
import type { CurveBlock } from "@/components/today/EnergyCurve";
import type { AskRecord, DaySnapshot } from "@/server/types";

/** Friendly labels for the seeded fixed commitments. */
const FIXED_LABELS: Record<string, string> = {
  "fixed-commute": "Commute",
  "fixed-standup": "Team standup",
};

/** Resolve a human label for any block from goals, asks, or fixed defaults. */
export function blockLabel(block: Block, goals: Goal[], asks: AskRecord[]): string {
  if (block.goalId) {
    return goals.find((g) => g.id === block.goalId)?.title ?? workTypeFallback(block.type);
  }
  if (block.id.startsWith("ask-")) {
    const ask = asks.find((a) => `ask-${a.id}` === block.id);
    if (ask) return shorten(ask.ask.description);
  }
  return FIXED_LABELS[block.id] ?? workTypeFallback(block.type);
}

function workTypeFallback(type: WorkType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function shorten(text: string): string {
  const firstClause = text.split(/[,.]/)[0] ?? text;
  return firstClause.length > 28 ? `${firstClause.slice(0, 27)}…` : firstClause;
}

export interface TodayView {
  startHour: number;
  endHour: number;
  currentHour: number;
  hourlyScores: number[];
  curveBlocks: CurveBlock[];
  currentBlock: { label: string; type: WorkType; startHour: number; endHour: number } | null;
}

/** Build everything the Today surface renders from a snapshot + the current time. */
export function buildTodayView(snapshot: DaySnapshot, now: Date): TodayView {
  const currentHour = hourOf(now);

  const curveBlocks: CurveBlock[] = snapshot.blocks.map((block) => ({
    id: block.id,
    startHour: hourOf(block.start),
    endHour: hourOf(block.end),
    type: block.type,
    label: blockLabel(block, snapshot.goals, snapshot.asks),
    source: block.source,
  }));

  const current = snapshot.blocks.find(
    (b) => b.start.getTime() <= now.getTime() && now.getTime() < b.end.getTime(),
  );
  const currentBlock = current
    ? {
        label: blockLabel(current, snapshot.goals, snapshot.asks),
        type: current.type,
        startHour: hourOf(current.start),
        endHour: hourOf(current.end),
      }
    : null;

  return {
    startHour: DAY_START_HOUR,
    endHour: DAY_END_HOUR,
    currentHour,
    hourlyScores: snapshot.energy.hourlyScores,
    curveBlocks,
    currentBlock,
  };
}
