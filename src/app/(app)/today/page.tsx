import { getSnapshot } from "@/server/store";
import { buildTodayView } from "@/server/view";
import { EnergyCurve } from "@/components/today/EnergyCurve";
import { BudgetMeter } from "@/components/today/BudgetMeter";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatHourRange, workTypeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  const snapshot = getSnapshot();
  const view = buildTodayView(snapshot, new Date());

  const chronotype = snapshot.energy.chronotype;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Your energy curve, the blocks laid beneath it, and what the budget has left.
          </p>
        </div>
        <Badge className="capitalize">{chronotype} chronotype</Badge>
      </header>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Energy &amp; schedule</h2>
          {view.currentBlock ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Now:</span>
              <Badge type={view.currentBlock.type}>{view.currentBlock.label}</Badge>
              <span className="text-neutral-400">
                {formatHourRange(view.currentBlock.startHour, view.currentBlock.endHour)}
              </span>
            </div>
          ) : (
            <span className="text-sm text-neutral-400">No block scheduled right now</span>
          )}
        </div>
        <EnergyCurve
          hourlyScores={view.hourlyScores}
          startHour={view.startHour}
          endHour={view.endHour}
          currentHour={view.currentHour}
          blocks={view.curveBlocks}
        />
        <Legend />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <BudgetMeter budget={snapshot.budget} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">The day, in order</h2>
          {view.curveBlocks.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing scheduled yet. Add goals and the scheduler will lay out your day.
            </p>
          ) : (
            <ul className="space-y-2">
              {view.curveBlocks
                .slice()
                .sort((a, b) => a.startHour - b.startHour)
                .map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-neutral-500 tabular-nums">
                        {formatHourRange(block.startHour, block.endHour)}
                      </span>
                      <span className="font-medium text-neutral-900">{block.label}</span>
                    </div>
                    <Badge type={block.type}>
                      {block.source === "fixed" ? "Fixed" : workTypeLabel(block.type)}
                    </Badge>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["Deep work", "#6366f1"],
    ["Shallow", "#0ea5e9"],
    ["Admin", "#a3a3a3"],
    ["Health", "#10b981"],
    ["Social", "#f59e0b"],
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-neutral-400" />
        Fixed commitment
      </span>
    </div>
  );
}
