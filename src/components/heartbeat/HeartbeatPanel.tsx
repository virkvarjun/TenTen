"use client";

import { useState, useTransition } from "react";
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
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <span
            aria-hidden
            className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
          />
          <p>
            You set aside this hour for <strong>{current.label}</strong>, but your last check-in
            logged something else. No judgement — just a nudge. Want to get back to it, or re-plan?
          </p>
        </div>
      )}

      <Card>
        {current ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-500">Scheduled right now</p>
                <p className="mt-0.5 font-medium text-neutral-900">{current.label}</p>
              </div>
              <Badge type={current.type}>{workTypeLabel(current.type)}</Badge>
            </div>

            {confirmed ? (
              <p className="text-sm text-emerald-700">Logged. Back to it — I’ll stay quiet.</p>
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
              <div className="grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-[1fr_2fr_auto]">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WorkType)}
                  aria-label="What are you actually doing?"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <Button onClick={relog} disabled={pending}>
                  Log
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-neutral-700">Nothing scheduled right now.</p>
            <p className="mt-1 text-sm text-neutral-500">
              There’s nothing to check, so Meridian stays quiet. Heartbeat only speaks up when your
              day drifts from what mattered.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Today’s check-ins</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">No check-ins logged yet today.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-neutral-500 tabular-nums">{formatHour(c.hour)}</span>
                <Badge type={c.actualType}>{workTypeLabel(c.actualType)}</Badge>
                {c.note && <span className="text-neutral-600">{c.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
