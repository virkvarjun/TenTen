import { getSnapshot } from "@/server/store";
import { buildTodayView } from "@/server/view";
import { EnergyCurve } from "@/components/today/EnergyCurve";
import { BudgetMeter } from "@/components/today/BudgetMeter";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { formatHourRange, workTypeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  const snapshot = getSnapshot();
  const view = buildTodayView(snapshot, new Date());
  const chronotype = snapshot.energy.chronotype;

  return (
    <div className="space-y-6">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Today</h1>
            <p className="text-ink-soft mt-1 text-sm">
              Your energy across the day, the blocks laid beneath it, and what the budget has left.
            </p>
          </div>
          <Badge className="capitalize">{chronotype} chronotype</Badge>
        </header>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-ink text-sm font-semibold tracking-tight">
              Energy &amp; schedule
            </h2>
            {view.currentBlock ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-soft">Now</span>
                <Badge type={view.currentBlock.type}>{view.currentBlock.label}</Badge>
                <span className="text-ink-faint font-mono text-xs">
                  {formatHourRange(view.currentBlock.startHour, view.currentBlock.endHour)}
                </span>
              </div>
            ) : (
              <span className="text-ink-faint text-sm">No block scheduled right now</span>
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
      </Reveal>

      <div className="grid gap-6 md:grid-cols-2">
        <Reveal delay={0.1}>
          <Card>
            <BudgetMeter budget={snapshot.budget} />
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card>
            <h2 className="font-display text-ink mb-3 text-sm font-semibold tracking-tight">
              The day, in order
            </h2>
            {view.curveBlocks.length === 0 ? (
              <p className="text-ink-soft text-sm">
                Nothing scheduled yet. Add goals and the scheduler will lay out your day.
              </p>
            ) : (
              <ul className="space-y-2">
                {view.curveBlocks
                  .slice()
                  .sort((a, b) => a.startHour - b.startHour)
                  .map((block) => (
                    <li key={block.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-ink-faint w-20 font-mono text-xs">
                          {formatHourRange(block.startHour, block.endHour)}
                        </span>
                        <span className="text-ink font-medium">{block.label}</span>
                      </div>
                      <Badge type={block.type}>
                        {block.source === "fixed" ? "fixed" : workTypeLabel(block.type)}
                      </Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["Deep work", "#3d5afe"],
    ["Shallow", "#4d8bd4"],
    ["Admin", "#8b93a1"],
    ["Health", "#12b5a8"],
    ["Social", "#f2a65a"],
  ];
  return (
    <div className="text-ink-soft mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px]">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="border-ink-faint h-2.5 w-2.5 rounded-xs border border-dashed" />
        Fixed commitment
      </span>
    </div>
  );
}
