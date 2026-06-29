import { getSnapshot } from "@/server/store";
import { pacingFor, progressFraction } from "@/domain/goals/goals";
import { DEMO_WEEK_FRACTION } from "@/server/mock/seed";
import { GoalsBoard } from "@/components/goals/GoalsBoard";
import type { GoalView } from "@/components/goals/types";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  const snapshot = getSnapshot();

  const goals: GoalView[] = snapshot.goals.map((goal) => ({
    ...goal,
    pacing: pacingFor(goal, DEMO_WEEK_FRACTION),
    progressFraction: progressFraction(goal),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-ink-soft mt-1 text-sm">
          Your portfolio. Weight sets priority; the scheduler spends your best hours on what weighs
          most and is furthest behind.
        </p>
      </header>
      <GoalsBoard goals={goals} />
    </div>
  );
}
