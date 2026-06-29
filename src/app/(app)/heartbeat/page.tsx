import { getSnapshot } from "@/server/store";
import { blockLabel } from "@/server/view";
import { hourOf } from "@/domain/time";
import { HeartbeatPanel, type CheckInView } from "@/components/heartbeat/HeartbeatPanel";

export const dynamic = "force-dynamic";

export default function HeartbeatPage() {
  const snapshot = getSnapshot();
  const now = new Date();

  const currentBlock = snapshot.blocks.find(
    (b) => b.start.getTime() <= now.getTime() && now.getTime() < b.end.getTime(),
  );

  const recent: CheckInView[] = snapshot.checkIns.map((c) => ({
    id: c.id,
    hour: hourOf(c.timestamp),
    actualType: c.actualType,
    note: c.note,
  }));

  const latest = recent[recent.length - 1];
  // Heartbeat only nudges when a high-value (deep) block is drifting from reality.
  const drifting =
    !!currentBlock &&
    currentBlock.type === "deep" &&
    !!latest &&
    latest.actualType !== currentBlock.type;

  const current = currentBlock
    ? {
        label: blockLabel(currentBlock, snapshot.goals, snapshot.asks),
        type: currentBlock.type,
        startHour: hourOf(currentBlock.start),
        endHour: hourOf(currentBlock.end),
        blockId: currentBlock.id,
      }
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Heartbeat</h1>
        <p className="text-ink-soft mt-1 text-sm">
          A low-friction pulse. One tap to confirm you’re on plan — and a quiet nudge only when you
          drift from the work that mattered.
        </p>
      </header>
      <HeartbeatPanel current={current} drifting={drifting} recent={recent} />
    </div>
  );
}
