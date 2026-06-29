"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import type { Verdict } from "@/domain/types";
import { hourOf } from "@/domain/time";
import {
  acceptAskAction,
  declineAskAction,
  submitAskAction,
  undoAskAction,
  type SubmitAskResult,
} from "@/server/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatHourRange, formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

const EXAMPLES = [
  "Raj wants to run at 4, ~45 min",
  "Coffee with Sam at 2, 30 min",
  "Investor call at 10, 1 hour",
];

const VERDICT_STYLE: Record<Verdict, { ring: string; chip: string; label: string }> = {
  accept: {
    ring: "border-good/35 bg-good/8",
    chip: "bg-good text-white",
    label: "Accept",
  },
  defer: {
    ring: "border-warn/40 bg-warn/8",
    chip: "bg-warn text-white",
    label: "Defer",
  },
  decline: {
    ring: "border-bad/35 bg-bad/8",
    chip: "bg-bad text-white",
    label: "Decline",
  },
};

export interface AskHistoryView {
  id: string;
  description: string;
  verdict: Verdict;
  rationale: string;
  status: string;
  engine: "heuristic" | "llm";
  slot: { startHour: number; endHour: number } | null;
  createdHour: number;
}

export function EventsBoard({ history }: { history: AskHistoryView[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SubmitAskResult | null>(null);

  function submit() {
    if (!text.trim()) return;
    start(async () => {
      const res = await submitAskAction(text.trim());
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <label htmlFor="ask" className="text-ink block text-sm font-medium">
          Someone’s asking for your time. What is it?
        </label>
        <textarea
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. Raj wants to run at 4, ~45 min"
          className="border-line focus-visible:ring-signal w-full resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="border-line bg-canvas text-ink-soft hover:bg-line-soft rounded-full border px-3 py-1 text-xs"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending || !text.trim()}>
            {pending ? "Reasoning…" : "Ask Meridian"}
          </Button>
        </div>
      </Card>

      {pending && <ThinkingCard />}

      {result && !pending && (
        <ResultCard
          result={result}
          onAccept={() => start(() => acceptAskAction(result.recordId))}
          onDecline={() => start(() => declineAskAction(result.recordId))}
          busy={pending}
        />
      )}

      <section>
        <h2 className="text-ink mb-3 text-sm font-semibold">Earlier decisions</h2>
        {history.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No asks yet. Try one of the examples — you’ll get a verdict with the reasoning behind
            it.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <HistoryRow
                key={h.id}
                item={h}
                busy={pending}
                onUndo={() => start(() => undoAskAction(h.id))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ThinkingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="text-ink-soft flex items-center gap-3 text-sm">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="bg-signal inline-block h-1.5 w-1.5 rounded-full"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            />
          ))}
        </span>
        Weighing this against your goals, energy, and remaining budget…
      </Card>
    </motion.div>
  );
}

function ResultCard({
  result,
  onAccept,
  onDecline,
  busy,
}: {
  result: SubmitAskResult;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const { decision, parsed, engine } = result;
  const style = VERDICT_STYLE[decision.verdict];
  const slot = decision.suggestedSlot
    ? {
        startHour: hourOf(new Date(decision.suggestedSlot.start)),
        endHour: hourOf(new Date(decision.suggestedSlot.end)),
      }
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className={cn("border-2", style.ring)}>
        <div className="mb-3 flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-tight",
              style.chip,
            )}
          >
            {style.label}
          </span>
          <span className="text-ink-soft font-mono text-xs">
            {engine === "llm" ? "Claude" : "Heuristic engine"} ·{" "}
            {formatHours(parsed.durationMin / 60)}
          </span>
        </div>

        <p className="text-ink text-sm leading-relaxed">{decision.rationale}</p>

        {slot && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-ink-soft">
              {decision.verdict === "accept" ? "Slotting at" : "Better slot"}:
            </span>
            <span className="text-ink font-medium">
              {formatHourRange(slot.startHour, slot.endHour)}
            </span>
          </div>
        )}

        {decision.displaces.length > 0 && (
          <p className="text-ink-soft mt-1 text-xs">Would move: {decision.displaces.join(", ")}</p>
        )}

        <div className="mt-4 flex gap-2">
          {decision.verdict !== "decline" && (
            <Button onClick={onAccept} disabled={busy}>
              {decision.verdict === "accept" ? "Add to my day" : "Take the better slot"}
            </Button>
          )}
          <Button variant="secondary" onClick={onDecline} disabled={busy}>
            {decision.verdict === "decline" ? "Got it" : "Pass"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function HistoryRow({
  item,
  busy,
  onUndo,
}: {
  item: AskHistoryView;
  busy: boolean;
  onUndo: () => void;
}) {
  const style = VERDICT_STYLE[item.verdict];
  return (
    <Card className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", style.chip)}>
            {style.label}
          </span>
          <span className="text-ink truncate text-sm font-medium">{item.description}</span>
        </div>
        <p className="text-ink-soft mt-1 line-clamp-2 text-xs">{item.rationale}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.slot && (
          <span className="text-ink-soft text-xs tabular-nums">
            {formatHourRange(item.slot.startHour, item.slot.endHour)}
          </span>
        )}
        {item.status === "accepted" && (
          <Button size="sm" variant="ghost" onClick={onUndo} disabled={busy}>
            Undo
          </Button>
        )}
      </div>
    </Card>
  );
}
