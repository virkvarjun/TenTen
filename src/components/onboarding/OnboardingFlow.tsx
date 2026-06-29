"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { Chronotype, WorkType } from "@/domain/types";
import {
  beginOnboardingAction,
  completeOnboardingAction,
  onboardCeilingAction,
  onboardChronotypeAction,
  onboardGoalsAction,
  onboardWorkPatternAction,
} from "@/server/actions";
import { Button } from "@/components/ui/Button";
import { workTypeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

interface GoalDraft {
  title: string;
  type: WorkType;
  targetHoursPerWeek: number;
}

interface Answers {
  chronotype: Chronotype;
  ceiling: number;
  goals: GoalDraft[];
  workStartHour: number;
  workEndHour: number;
  inOffice: boolean;
  commuteMinutes: number;
}

const DEFAULT_ANSWERS: Answers = {
  chronotype: "neutral",
  ceiling: 5,
  goals: [],
  workStartHour: 9,
  workEndHour: 17,
  inOffice: true,
  commuteMinutes: 30,
};

const EXAMPLE_GOALS: GoalDraft[] = [
  { title: "Ship the product", type: "deep", targetHoursPerWeek: 12 },
  { title: "Write & think", type: "deep", targetHoursPerWeek: 5 },
  { title: "Inbox & ops", type: "admin", targetHoursPerWeek: 4 },
  { title: "Training", type: "health", targetHoursPerWeek: 5 },
  { title: "People I love", type: "social", targetHoursPerWeek: 4 },
];

const TYPES: WorkType[] = ["deep", "shallow", "admin", "health", "social"];
const STORAGE_KEY = "meridian-onboarding";
const TOTAL_STEPS = 6;

export function OnboardingFlow({ calendarConfigured }: { calendarConfigured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);

  // Resume from where they left off.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { step: number; answers: Answers };
        setStep(parsed.step);
        setAnswers({ ...DEFAULT_ANSWERS, ...parsed.answers });
      } catch {
        // ignore malformed state
      }
    }
    void beginOnboardingAction();
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
  }, [step, answers, loaded]);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    start(async () => {
      // Commit every answer to the model, then reveal the day.
      await onboardChronotypeAction(answers.chronotype);
      await onboardCeilingAction(answers.ceiling);
      await onboardGoalsAction(answers.goals.length ? answers.goals : EXAMPLE_GOALS.slice(0, 4));
      await onboardWorkPatternAction({
        workStartHour: answers.workStartHour,
        workEndHour: answers.workEndHour,
        inOffice: answers.inOffice,
        commuteMinutes: answers.commuteMinutes,
      });
      await completeOnboardingAction();
      localStorage.removeItem(STORAGE_KEY);
      router.push("/today");
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      <Progress step={step} />
      <div className="mt-8 flex-1">
        {step === 0 && <Welcome />}
        {step === 1 && (
          <ChronotypeStep value={answers.chronotype} onChange={(v) => set("chronotype", v)} />
        )}
        {step === 2 && <CeilingStep value={answers.ceiling} onChange={(v) => set("ceiling", v)} />}
        {step === 3 && <GoalsStep goals={answers.goals} onChange={(v) => set("goals", v)} />}
        {step === 4 && <WorkStep answers={answers} set={set} />}
        {step === 5 && <CalendarStep configured={calendarConfigured} />}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || pending}>
          Back
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          <Button onClick={next} disabled={step === 3 && answers.goals.length < 3}>
            Continue
          </Button>
        ) : (
          <Button onClick={finish} disabled={pending}>
            {pending ? "Building your day…" : "Show me my first day"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i <= step ? "bg-indigo-500" : "bg-neutral-200",
          )}
        />
      ))}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
    </div>
  );
}

function Welcome() {
  return (
    <div>
      <p className="mb-2 text-sm font-medium tracking-widest text-indigo-500 uppercase">Meridian</p>
      <StepHeader
        title="Let’s tune Meridian to you."
        subtitle="Two minutes. We’ll learn when your energy peaks, how much deep focus a good day holds, and what actually matters to you — so your very first day already feels like yours, not a template."
      />
      <p className="text-sm text-neutral-500">
        Everything here is a starting point. Meridian keeps learning from what you actually do.
      </p>
    </div>
  );
}

const CHRONOTYPES: Array<{ value: Chronotype; label: string; blurb: string }> = [
  { value: "lark", label: "Early bird", blurb: "Sharpest in the morning, fading by evening." },
  {
    value: "neutral",
    label: "In between",
    blurb: "A morning peak, an afternoon dip, a second wind.",
  },
  {
    value: "owl",
    label: "Night owl",
    blurb: "Slow to start, strongest in the late afternoon and evening.",
  },
];

function ChronotypeStep({
  value,
  onChange,
}: {
  value: Chronotype;
  onChange: (v: Chronotype) => void;
}) {
  return (
    <div>
      <StepHeader
        title="When are you at your sharpest?"
        subtitle="This seeds your energy curve. Night owl? We’ll protect your evenings for deep work and keep your groggy mornings light."
      />
      <div className="space-y-3">
        {CHRONOTYPES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-colors",
              value === c.value
                ? "border-indigo-500 bg-indigo-50"
                : "border-neutral-200 hover:border-neutral-300",
            )}
          >
            <div className="font-medium text-neutral-900">{c.label}</div>
            <div className="text-sm text-neutral-600">{c.blurb}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">
        Not sure? “In between” is a safe default — the curve will sharpen as Meridian learns you.
      </p>
    </div>
  );
}

function CeilingStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <StepHeader
        title="How many genuinely focused hours does a good day hold?"
        subtitle="Not hours at a desk — hours of real, undistracted depth. For almost everyone that’s four to six. The cap is the feature: protect those hours and the rest of the day gets easier."
      />
      <div className="rounded-xl border border-neutral-200 p-6">
        <div className="mb-4 text-center">
          <span className="text-4xl font-semibold text-neutral-900">{value}</span>
          <span className="ml-1 text-neutral-500">hours / day</span>
        </div>
        <input
          type="range"
          min={4}
          max={6}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-indigo-500"
          aria-label="Deep-work ceiling"
        />
        <div className="mt-1 flex justify-between text-xs text-neutral-400">
          <span>4 — protective</span>
          <span>6 — ambitious</span>
        </div>
      </div>
    </div>
  );
}

function GoalsStep({
  goals,
  onChange,
}: {
  goals: GoalDraft[];
  onChange: (v: GoalDraft[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkType>("deep");
  const [hours, setHours] = useState(5);

  function add() {
    if (!title.trim() || goals.length >= 6) return;
    onChange([...goals, { title: title.trim(), type, targetHoursPerWeek: hours }]);
    setTitle("");
    setType("deep");
    setHours(5);
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...goals];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function remove(index: number) {
    onChange(goals.filter((_, i) => i !== index));
  }

  return (
    <div>
      <StepHeader
        title="What are you actually pursuing?"
        subtitle="Add three to six. Order them by what matters most — the one on top gets first claim on your peak hours."
      />

      {goals.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {EXAMPLE_GOALS.map((g) => (
            <button
              key={g.title}
              type="button"
              onClick={() => onChange([...goals, g])}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
            >
              + {g.title}
            </button>
          ))}
        </div>
      )}

      <ul className="mb-4 space-y-2">
        {goals.map((g, i) => (
          <li
            key={`${g.title}-${i}`}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3"
          >
            <span className="w-5 text-center text-xs font-semibold text-neutral-400">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-900">{g.title}</div>
              <div className="text-xs text-neutral-500">
                {workTypeLabel(g.type)} · {g.targetHoursPerWeek}h/wk
              </div>
            </div>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === goals.length - 1}
              className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-1 text-red-400 hover:text-red-600"
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {goals.length < 6 && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a goal"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkType)}
            className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
            aria-label="Goal type"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {workTypeLabel(t)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={40}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-16 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
            aria-label="Hours per week"
          />
          <Button size="sm" onClick={add}>
            Add
          </Button>
        </div>
      )}
      {goals.length < 3 && (
        <p className="mt-3 text-xs text-neutral-500">Add at least three to continue.</p>
      )}
    </div>
  );
}

function WorkStep({
  answers,
  set,
}: {
  answers: Answers;
  set: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  return (
    <div>
      <StepHeader
        title="What does a working day look like?"
        subtitle="So Meridian doesn’t schedule deep work while you’re commuting — and knows which hours are really yours."
      />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Work starts"
            value={answers.workStartHour}
            min={5}
            max={12}
            onChange={(v) => set("workStartHour", v)}
            suffix=":00"
          />
          <NumberField
            label="Work ends"
            value={answers.workEndHour}
            min={13}
            max={22}
            onChange={(v) => set("workEndHour", v)}
            suffix=":00"
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={answers.inOffice}
            onChange={(e) => set("inOffice", e.target.checked)}
            className="h-4 w-4 accent-indigo-500"
          />
          I commute to an office on a typical day
        </label>
        {answers.inOffice && (
          <NumberField
            label="Commute each way (minutes)"
            value={answers.commuteMinutes}
            min={0}
            max={120}
            step={5}
            onChange={(v) => set("commuteMinutes", v)}
          />
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {suffix && <span className="text-sm text-neutral-400">{suffix}</span>}
      </div>
    </div>
  );
}

function CalendarStep({ configured }: { configured: boolean }) {
  return (
    <div>
      <StepHeader
        title="Connect your calendar?"
        subtitle="Optional, but it makes Meridian real. It reads your day to lay deep work around your meetings — and only ever writes to your calendar after you confirm, never silently."
      />
      {configured ? (
        <Button
          variant="secondary"
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
        >
          Connect Google Calendar
        </Button>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          Calendar sync isn’t configured in this environment yet. You can skip this — Meridian works
          on its own, and you can connect later from settings.
        </div>
      )}
      <p className="mt-4 text-xs text-neutral-500">
        You’re one step from your first day. Skip if you’d rather connect later.
      </p>
    </div>
  );
}
