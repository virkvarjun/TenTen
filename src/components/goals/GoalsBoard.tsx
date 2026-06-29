"use client";

import { useState, useTransition } from "react";
import type { WorkType } from "@/domain/types";
import { addGoalAction, deleteGoalAction, updateGoalAction } from "@/server/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatHours, workTypeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GoalView } from "./types";

const TYPES: WorkType[] = ["deep", "shallow", "admin", "health", "social"];

const PACING_STYLE: Record<GoalView["pacing"], string> = {
  behind: "bg-red-100 text-red-700 border-red-200",
  "on-track": "bg-emerald-100 text-emerald-700 border-emerald-200",
  ahead: "bg-sky-100 text-sky-700 border-sky-200",
};

const PACING_LABEL: Record<GoalView["pacing"], string> = {
  behind: "Behind",
  "on-track": "On track",
  ahead: "Ahead",
};

export function GoalsBoard({ goals }: { goals: GoalView[] }) {
  return (
    <div className="space-y-6">
      <AddGoalForm />
      {goals.length === 0 ? (
        <Card className="text-center text-sm text-neutral-500">
          No goals yet. Add a few above — they’re the source of truth for what your day is for.
        </Card>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddGoalForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkType>("deep");
  const [weight, setWeight] = useState(5);
  const [target, setTarget] = useState(5);

  function submit() {
    if (!title.trim()) return;
    start(async () => {
      await addGoalAction({
        title: title.trim(),
        type,
        weight,
        targetHoursPerWeek: target,
      });
      setTitle("");
      setType("deep");
      setWeight(5);
      setTarget(5);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary">
        + Add a goal
      </Button>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <label htmlFor="goal-title" className="mb-1 block text-xs font-medium text-neutral-600">
          What are you pursuing?
        </label>
        <input
          id="goal-title"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. Ship the v1 release"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="goal-type" className="mb-1 block text-xs font-medium text-neutral-600">
            Type
          </label>
          <select
            id="goal-type"
            value={type}
            onChange={(e) => setType(e.target.value as WorkType)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {workTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <WeightControl value={weight} onChange={setWeight} />
        <div>
          <label htmlFor="goal-target" className="mb-1 block text-xs font-medium text-neutral-600">
            Hours / week
          </label>
          <input
            id="goal-target"
            type="number"
            min={0}
            max={40}
            step={0.5}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || !title.trim()}>
          {pending ? "Adding…" : "Add goal"}
        </Button>
      </div>
    </Card>
  );
}

function GoalRow({ goal }: { goal: GoalView }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(goal.weight);
  const [target, setTarget] = useState(goal.targetHoursPerWeek);
  const [progress, setProgress] = useState(goal.progressHours);

  const pct = Math.min(100, Math.round(goal.progressFraction * 100));

  function save() {
    start(async () => {
      await updateGoalAction(goal.id, {
        weight,
        targetHoursPerWeek: target,
        progressHours: progress,
      });
      setEditing(false);
    });
  }

  function remove() {
    start(() => deleteGoalAction(goal.id));
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-900">{goal.title}</span>
            <Badge type={goal.type}>{workTypeLabel(goal.type)}</Badge>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                PACING_STYLE[goal.pacing],
              )}
            >
              {PACING_LABEL[goal.pacing]}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-neutral-900 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
              {formatHours(goal.progressHours)} / {formatHours(goal.targetHoursPerWeek)} · weight{" "}
              {goal.weight}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
          <Button size="sm" variant="danger" onClick={remove} disabled={pending}>
            Delete
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-3">
          <WeightControl value={weight} onChange={setWeight} />
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Hours / week</label>
            <input
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Progress (hours)
            </label>
            <input
              type="number"
              min={0}
              max={40}
              step={0.25}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function WeightControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        Priority weight <span className="text-neutral-400">({value})</span>
      </label>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
        aria-label="Priority weight"
      />
    </div>
  );
}
