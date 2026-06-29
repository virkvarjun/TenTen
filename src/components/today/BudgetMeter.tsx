"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DeepWorkBudget } from "@/domain/types";
import { remainingHours, utilization } from "@/domain/budget/budget";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The deep-work budget meter: how much focus the day has left in it. */
export function BudgetMeter({ budget }: { budget: DeepWorkBudget }) {
  const reduce = useReducedMotion();
  const pct = Math.round(utilization(budget) * 100);
  const left = remainingHours(budget);
  const exhausted = left <= 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-ink text-sm font-semibold tracking-tight">
          Deep-work budget
        </span>
        <span className={cn("font-mono text-xs", exhausted ? "text-warn" : "text-ink-soft")}>
          {exhausted ? "spent for today" : `${formatHours(left)} left`}
        </span>
      </div>
      <div
        className="bg-line-soft h-3 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Deep-work budget used"
      >
        <motion.div
          className={cn("h-full rounded-full", exhausted ? "bg-warn" : "bg-signal")}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: 1.6, ease: "easeOut" }}
          style={reduce ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="text-ink-soft mt-2 text-xs">
        {formatHours(budget.allocatedHours)} of {formatHours(budget.dailyCeilingHours)} ceiling
        allocated. The cap is the point — focus is finite, and protecting it is the product.
      </p>
    </div>
  );
}
