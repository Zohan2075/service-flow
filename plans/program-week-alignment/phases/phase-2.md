---
type: planning
entity: phase
plan: "program-week-alignment"
phase: 2
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 2: Week-scoped state & rollover

> Part of [program-week-alignment](../plan.md)

## Objective

Fix the data carry-over bug at the store level and seed future weeks into the program config. The active session must be scoped to the active week, and `ensureActiveProgramWeek` must create the current week + 4 future weeks while preserving a manually selected future week.

## Scope

### Includes

- `web/src/lib/store.ts`:
  - Rewrite `ensureActiveProgramWeek` to:
    - Seed current week + `PROGRAM_WEEKS_AHEAD` future weeks (using Phase 1 helpers) when missing.
    - Advance the active week to the current week only when the current active week is in the past (stale/rollover) or missing; keep a future-selected week active (per user decision).
    - Clear `presidingSession` when it belongs to a different week than the new active week (fixes last-week data leaking into this week's timer buttons).
  - Update `addPresidingLogEntry` to start a fresh session for the active week when the current `presidingSession` belongs to a different week.
  - Update `importData` so `presidingSession` resolves to the session matching the current week (not blindly the last session in the array).
  - Align `migratePresidingConfig` roll path with the same "advance only if past" rule and future-week seeding.
- `web/src/app/(dashboard)/presiding/page.tsx`:
  - Derive `sessionLog` from the active week's session (prefer live session if it matches the active week, otherwise the latest stored session for that week), instead of the global `presidingSession.log`.

### Excludes (deferred to later phases)

- Session Review UI filter (Phase 3).
- "New Week" JW alignment (Phase 3).

## Prerequisites

- [ ] Phase 1 complete (helpers + seeding constant available)

## Deliverables

- [ ] Store logic week-scopes sessions and seeds 5 weeks.
- [ ] Page derives week-scoped `sessionLog`.

## Acceptance Criteria

- [ ] On page load with a 1-week config, `ensureActiveProgramWeek` produces 5 weeks (current + 4 ahead) and sets active to current.
- [ ] After manually switching to a future week (e.g., W36), the next `ensureActiveProgramWeek` call (60s timer) keeps W36 active.
- [ ] After a real rollover (active week < current week, e.g., W34 → W35), `ensureActiveProgramWeek` advances active to the current week.
- [ ] If `presidingSession` belongs to W34 and the active week is W35, `presidingSession` is cleared; `addPresidingLogEntry` creates a W35 session.
- [ ] `importData` with remote sessions sets `presidingSession` to the session for the current week (or null).
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Uses helpers/constant |
| Phase 3 | blocked-by | Page derives scoped `sessionLog` needed by Session Review |

## Notes

- Week IDs sort lexicographically for the same year (`2026-W34` < `2026-W35`); for cross-year the year prefix dominates, so string comparison is sufficient for "is past".
- The live `presidingSession` is preserved in `presidingSessions` history when cleared, so no data is lost.
- `withPendingSync` must only be triggered when state actually changes (avoid spurious sync flags).