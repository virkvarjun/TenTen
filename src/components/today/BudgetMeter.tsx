import type { DeepWorkBudget } from "@/domain/types";
import { remainingHours, utilization } from "@/domain/budget/budget";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The deep-work budget meter: how much focus the day has left in it. */
export function BudgetMeter({ budget }: { budget: DeepWorkBudget }) {
  const pct = Math.round(utilization(budget) * 100);
  const left = remainingHours(budget);
  const exhausted = left <= 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-neutral-900">Deep-work budget</span>
        <span
          className={cn(
            "text-sm font-medium",
            exhausted ? "text-amber-600" : "text-neutral-600",
          )}
        >
          {exhausted ? "Spent for today" : `${formatHours(left)} left`}
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Deep-work budget used"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            exhausted ? "bg-amber-500" : "bg-indigo-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {formatHours(budget.allocatedHours)} of {formatHours(budget.dailyCeilingHours)} ceiling
        allocated. The cap is the point — focus is finite, and protecting it is the product.
      </p>
    </div>
  );
}
