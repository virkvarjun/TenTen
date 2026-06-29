# CLAUDE.md — Meridian

The project's living memory. Keep it truthful: when the architecture drifts from
what's written here, fix the doc in the same commit.

## The product

Meridian is an operating system for your attention. It learns the user's personal
energy curve and follow-through, spends a hard-capped deep-work budget (4–6
hours/day) on their highest-weight goals during peak hours, routes everything else
to troughs, and answers incoming asks (e.g. "a friend wants to run at 4") by
reasoning about goals + energy + remaining budget at once.

**The differentiated core is the energy-aware decision engine.** Calendar sync and
the interval check-in are supporting plumbing, not the point.

## Domain glossary (canonical vocabulary)

The shapes below live in `src/domain/types.ts` and are the single source of truth.

- **Goal** — something the user is pursuing. Has `weight` (priority), `type`
  (`deep` | `shallow` | `admin` | `health` | `social`), `targetHoursPerWeek`, live
  `progressHours`, and `status`. The portfolio of goals is the app's source of
  truth for "what matters."
- **Energy model** (`EnergyProfile`) — a per-user curve of 24 hourly energy scores
  (0–1). Starts from a chronotype default (`lark` | `neutral` | `owl`), then learns
  from behaviour.
- **Deep-work budget** (`DeepWorkBudget`) — a daily ceiling of focus hours (default
  5, clamped 4–6). Deep-type work _draws it down_; when spent, the app stops
  scheduling focus work and routes to shallow/recovery.
- **Block** — a scheduled span on the timeline. Goal-linked or fixed (meeting,
  commute). Carries an `energyMatchScore` (how well its type fits the energy at that
  hour) and a `source` (`planned` | `fixed`).
- **Decision engine** — `(goals, energy, budget, calendar, ask) -> { verdict,
suggestedSlot, displaces, rationale }`. `verdict` is `accept` | `defer` |
  `decline`.
- **Heartbeat / check-in** — a low-friction interval ping recording what you
  actually did vs. the planned block. Feeds the learning loop. Silent unless you're
  drifting.
- **Learning loop** — a nightly job that updates the energy curve and follow-through
  stats from check-ins.

## Stack

- **Next.js 15** (App Router) + **TypeScript** strict
- **Tailwind CSS v4** + a custom component layer (shadcn primitives only — Phase 5)
- **Motion** (`framer-motion`) for animation
- **Auth.js (NextAuth v5 beta)** with the Google provider (sign-in + Calendar OAuth)
- **Prisma 6** + **Postgres** (Docker locally, Neon/Supabase in cloud)
- **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) + **Zod** for validated output
- **Vitest** + **Testing Library** + **Playwright**
- Deploy target **Vercel**; **Vercel Cron** for the nightly learning job

> Note: Prisma is pinned to v6 (v7 dropped `url` in the schema datasource in favor
> of driver adapters + `prisma.config.ts`; v6 is the stable, well-supported line).
> ESLint uses flat config (`eslint.config.mjs`) on ESLint 9.

## Folder structure

```
prisma/                 Prisma schema (+ migrations from Phase 3)
src/
  app/                  Next.js App Router — routes + API. Thin; calls domain.
  domain/               PURE logic. Zero Next/React/Prisma imports (lint-enforced).
    goals/  energy/  budget/  decision-engine/  learning/
    types.ts            Canonical domain vocabulary.
  components/           Dumb UI. ui/ holds primitives (Phase 5 styles them).
  lib/                  Framework glue: db client, env access, cn() helper.
  server/               Server actions / data-access layer (Phase 2+).
tests/                  Vitest unit + component tests (mirror src/domain).
e2e/                    Playwright E2E (Phase 6).
```

## Conventions

- **The load-bearing seam:** domain logic is framework-agnostic and pure. UI is
  dumb and calls domain functions. The heuristic and LLM decision engines share one
  interface (`DecisionEngine`) so they are drop-in swappable. Protect this seam.
- **Strict types everywhere; no `any`** (lint-enforced via
  `@typescript-eslint/no-explicit-any: error`).
- `src/domain/**` may not import `next`, `react`, `react-dom`, `@/app/*`, or
  `@/components/*` (lint-enforced via `no-restricted-imports`).
- Data access goes through `src/lib/db.ts` / `src/server/**`; components never call
  Prisma directly.
- Env vars are read through `src/lib/env.ts`; integrations degrade gracefully when a
  key is absent rather than crashing.
- **Commits:** small, per-surface, conventional-commit messages
  (`feat:`, `chore:`, `fix:`, `test:`, `docs:`).

## Scripts

| Script                                          | Purpose                                 |
| ----------------------------------------------- | --------------------------------------- |
| `pnpm dev`                                      | Run the dev server                      |
| `pnpm build`                                    | Production build (fails on type errors) |
| `pnpm typecheck`                                | `tsc --noEmit`                          |
| `pnpm lint`                                     | ESLint (flat config)                    |
| `pnpm format`                                   | Prettier write                          |
| `pnpm test`                                     | Vitest unit/component tests             |
| `pnpm test:e2e`                                 | Playwright E2E                          |
| `pnpm db:up` / `:down`                          | Local Postgres via docker-compose       |
| `pnpm prisma:generate` / `:migrate` / `:studio` | Prisma tooling                          |

## Current status

**Phase 1 — complete.** Scaffold + docs (see git history).

**Phase 2 — complete.** Full V1 on mock data with the deterministic heuristic
engine. No external calls anywhere.

- **Domain logic** (`src/domain`, pure): `energy/` (chronotype curves, match
  scores, peak/trough windows), `budget/` (allocation with the hard 4–6h refusal),
  `goals/` (pacing + contention ranking), `scheduler/` (lays deep work onto peaks,
  shallow/admin into troughs, respects fixed blocks, stops at budget),
  `decision-engine/` (heuristic engine + the Zod output schema), `time.ts`.
- **Server layer** (`src/server`): an in-memory `store.ts` seeded from
  `mock/seed.ts` (6 goals across all types, neutral curve, 5h budget, two fixed
  commitments, a half-planned day); `ask-parser.ts` (NL → `Ask`);
  `decision/engine.ts` (the factory — heuristic today, LLM-swappable in Phase 3);
  thin `actions.ts` server actions; `view.ts` view-model builders.
- **Surfaces** (`src/app/(app)`): **Today** (the signature SVG energy curve with
  blocks laid beneath, current-hour marker, budget meter, ordered day list),
  **Goals** (CRUD with weight slider, type, weekly target, live progress, pacing),
  **Heartbeat** (one-tap check-in, silent unless a deep block is drifting),
  **Events** (NL composer → verdict card with rationale + slot + displaces → accept
  rebalances the day; undoable; history).
- **UI primitives** in `src/components/ui` (Button, Card, Badge) — deliberately
  quiet; Phase 5 gives them a real design language.

The engine seam is live: `decide()` in `src/server/decision/engine.ts` is the only
thing surfaces call; swapping in the LLM engine touches nothing else.

**Phase 3 — complete.** Real integrations, each degrading gracefully when its env
var is absent (the app always runs).

- **LLM decision engine** (`src/server/decision/llm.ts`): Claude (`claude-opus-4-8`)
  behind the same `Decision` contract. The factory (`engine.ts`) picks LLM when
  `ANTHROPIC_API_KEY` is set, else heuristic. Free/busy + budget math is computed
  deterministically in code and handed to the model as facts; the model only
  reasons. Output is constrained to JSON and validated with the Zod
  `llmDecisionSchema`; on parse/validation/API failure it retries once, then the
  factory falls back to the heuristic engine. Unvalidated output never reaches the
  UI.
- **Google Calendar** (`src/auth.ts` + `src/server/calendar/google.ts`): Auth.js v5
  Google provider with `calendar.readonly` + `calendar.events` scopes (configured
  only when Google creds exist). The Calendar service reads the day's events as
  fixed blocks, writes accepted asks as events, and deletes them for undo — writes
  always behind an explicit in-app confirm (caller-enforced).
- **Persistence** (`prisma/schema.prisma`): full Postgres schema — Auth.js tables +
  Goal/EnergyProfile/DeepWorkBudget/Block/Ask/CheckIn mapping the domain types.
  The running demo still uses the in-memory `store.ts` (active default); the schema
  is the migration target when `DATABASE_URL` is configured.
- **Learning loop** (`src/domain/learning/learning.ts` + `/api/cron/learn`):
  conservative exponential-smoothing nudge of the energy curve toward hours where
  focus work actually happened, plus follow-through stats. Triggered by Vercel Cron
  (`vercel.json`, 05:00 daily), protected by `CRON_SECRET`, idempotent per day.

**Phase 4 — complete.** Onboarding (`/onboarding`, `OnboardingFlow.tsx`): a
six-step warm flow (welcome → chronotype → deep-work ceiling → goal portfolio with
drag-to-rank → work/commute pattern → connect calendar → reveal Today). Each step
writes to the model via incremental server actions (`onboard*Action`); progress is
persisted to `localStorage` so it's resumable, and re-runnable from the header
"Recalibrate" link. Ends by rendering the seeded Today view. Calendar step
degrades when Google isn't configured.

**Phase 5 — complete.** Design language + motion.

- **Design language** — _"a spectrograph at rest."_ Tokens in `globals.css`
  (`@theme`): palette (`ink #14161B`, `canvas #EEF1F5`, `surface`, `line`, and the
  energy spectrum `peak #3D5AFE` / `mid #12B5A8` / `trough #F2A65A`), three fonts
  (Space Grotesk display, Archivo body, JetBrains Mono data), a soft radius scale.
  All surfaces + primitives derive from tokens (no stock neutral/indigo).
- **Signature** — the energy curve is a spectrograph: the stroke's hue encodes
  energy temperature along the day, on a fine tick baseline, with a mono current-
  hour readout. `EnergyCurve.tsx`.
- **Motion** (`framer-motion`) — one orchestrated Today page-load (curve draws →
  blocks settle → budget fills), a breathing current-hour marker, an LLM "thinking"
  state resolving into the verdict card, a quiet heartbeat-drift pulse, and `Reveal`
  micro-entrances. `prefers-reduced-motion` is respected everywhere (curve/blocks
  render static; a global CSS fallback neutralises transitions).
- **Quality floor** — responsive grids, visible `focus-visible` rings on every
  control, designed empty/error copy, consistent action vocabulary.
- Screenshots in `docs/screenshots/` (generated via Playwright).

**Next: Phase 6** — the test suite: domain unit tests, the LLM output contract,
key API routes, component tests, and an E2E happy path; CI on every push.
