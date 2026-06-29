import { getSnapshot } from "@/server/store";
import { hourOf } from "@/domain/time";
import { EventsBoard, type AskHistoryView } from "@/components/events/EventsBoard";

export const dynamic = "force-dynamic";

export default function EventsPage() {
  const snapshot = getSnapshot();

  const history: AskHistoryView[] = snapshot.asks.map((record) => ({
    id: record.id,
    description: record.ask.description,
    verdict: record.decision.verdict,
    rationale: record.decision.rationale,
    status: record.status,
    engine: record.engine,
    slot: record.decision.suggestedSlot
      ? {
          startHour: hourOf(record.decision.suggestedSlot.start),
          endHour: hourOf(record.decision.suggestedSlot.end),
        }
      : null,
    createdHour: hourOf(record.createdAt),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Hand Meridian an incoming ask. It weighs your goals, your energy, and your remaining
          budget — then tells you to accept, defer, or decline, and why.
        </p>
      </header>
      <EventsBoard history={history} />
    </div>
  );
}
