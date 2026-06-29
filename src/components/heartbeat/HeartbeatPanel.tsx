"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import type { WorkType } from "@/domain/types";
import { checkInAction } from "@/server/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatHour, workTypeLabel } from "@/lib/format";

const TYPES: WorkType[] = ["deep", "shallow", "admin", "health", "social"];

export interface CheckInView {
  id: string;
  hour: number;
  actualType: WorkType;
  note?: string;
}

export interface HeartbeatPanelProps {
  current: {
    label: string;
    type: WorkType;
    startHour: number;
    endHour: number;
    blockId: string;
  } | null;
  drifting: boolean;
  recent: CheckInView[];
}

export function HeartbeatPanel({ current, drifting, recent }: HeartbeatPanelProps) {
  const [pending, start] = useTransition();
  const [relogging, setRelogging] = useState(false);
  const [type, setType] = useState<WorkType>("deep");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function confirm() {
    if (!current) return;
    start(async () => {
      await checkInAction({ actualType: current.type, plannedBlockId: current.blockId });
      setConfirmed(true);
    });
  }

  function relog() {
    start(async () => {
      await checkInAction({
        actualType: type,
        note: note.trim() || undefined,
        plannedBlockId: current?.blockId,
      });
      setRelogging(false);
      setNote("");
      setConfirmed(true);
    });
  }

  return (
    <div className="space-y-6">
      {drifting && current && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="border-warn/35 bg-warn/8 flex items-start gap-3 rounded-md border p-4 text-sm text-[#8a5a1d]"
        >
          <motion.span
            aria-hidden
            className="bg-warn mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <p>
            You set aside this hour for <strong>{current.label}</strong>, but your last check-in
            logged something else. No judgement — just a nudge. Want to get back to it, or re-plan?
          </p>
        </motion.div>
      )}

      <Card>
        {current ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-ink-soft text-xs">Scheduled right now</p>
                <p className="text-ink mt-0.5 font-medium">{current.label}</p>
              </div>
              <Badge type={current.type}>{workTypeLabel(current.type)}</Badge>
            </div>

            {confirmed ? (
              <p className="text-good text-sm">Logged. Back to it — I’ll stay quiet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={confirm} disabled={pending}>
                  Still on it
                </Button>
                <Button variant="secondary" onClick={() => setRelogging((v) => !v)}>
                  Doing something else
                </Button>
              </div>
            )}

            {relogging && !confirmed && (
              <div className="border-line-soft grid gap-3 border-t pt-4 sm:grid-cols-[1fr_2fr_auto]">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WorkType)}
                  aria-label="What are you actually doing?"
                  className="border-line rounded-lg border px-3 py-2 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {workTypeLabel(t)}
                    </option>
                  ))}
                </select>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  className="border-line rounded-lg border px-3 py-2 text-sm"
                />
                <Button onClick={relog} disabled={pending}>
                  Log
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-ink text-sm font-medium">Nothing scheduled right now.</p>
            <p className="text-ink-soft mt-1 text-sm">
              There’s nothing to check, so Meridian stays quiet. Heartbeat only speaks up when your
              day drifts from what mattered.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-ink mb-3 text-sm font-semibold">Today’s check-ins</h2>
        {recent.length === 0 ? (
          <p className="text-ink-soft text-sm">No check-ins logged yet today.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <span className="text-ink-soft w-16 tabular-nums">{formatHour(c.hour)}</span>
                <Badge type={c.actualType}>{workTypeLabel(c.actualType)}</Badge>
                {c.note && <span className="text-ink-soft">{c.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
