import type { Goal, GoalPacing } from "@/domain/types";

/** A goal plus the derived pacing the UI renders. */
export interface GoalView extends Goal {
  pacing: GoalPacing;
  progressFraction: number;
}
