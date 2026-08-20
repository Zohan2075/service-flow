---
type: planning
entity: implementation-plan
plan: "program-week-alignment"
phase: 2
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 2 - Week-scoped state & rollover

> Implements [Phase 2](../phases/phase-2.md) of [program-week-alignment](../plan.md)

## Approach

Fix the data carry-over bug at the state level and seed future weeks.

1. `web/src/lib/store.ts`:
   - Rewrite `ensureActiveProgramWeek` to seed current + 4 future weeks, advance active week only when stale (past) or missing, and clear `presidingSession` when it belongs to a different week than the active week.
   - Update `addPresidingLogEntry` to create a fresh session for the active week when the current `presidingSession` belongs to another week.
   - Update `importData` so `presidingSession` resolves to the session for the current week (not the last session in the array).
   - Update `migratePresidingConfig` roll path to seed future weeks and use the same "advance only if past" rule.
2. `web/src/app/(dashboard)/presiding/page.tsx`: derive `sessionLog` from the active week's session(s) instead of the global `presidingSession.log`.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/lib/store.ts` | modify | Week-scoped session handling + future-week seeding + rollover semantics |
| `web/src/app/(dashboard)/presiding/page.tsx` | modify | Week-scoped `sessionLog` derivation |

## Required Context

| File | Why |
|------|-----|
| `web/src/lib/store.ts` lines 409–494 | `migratePresidingConfig` (roll path, week normalization) |
| `web/src/lib/store.ts` lines 1414–1520 | `ensureActiveProgramWeek`, `startPresidingSession`, `addPresidingLogEntry` |
| `web/src/lib/store.ts` lines 1310–1363 | `importData` (`presidingSession: nextSessions[nextSessions.length - 1]`) |
| `web/src/app/(dashboard)/presiding/page.tsx` lines 25–95 | Current `sessionLog` derivation + timer wiring |
| `web/src/types/presiding.ts` | `getProgramWeekId`, `getProgramWeekIdOffset`, `PROGRAM_WEEKS_AHEAD`, `getJwWolWeekCatalogEntry` (Phase 1) |
| `web/src/lib/sync.tsx` lines 108–191 | `performSync` push contract (state shape unchanged) |

## Implementation Steps

### Step 1: Rewrite `ensureActiveProgramWeek`

- **What**: Replace the current implementation (lines 1414–1425) with logic that:
  1. Computes `currentWeekId = getProgramWeekId(date)`.
  2. Builds a `Map` from existing `s.presidingConfig.weeks`.
  3. For `i = 0..PROGRAM_WEEKS_AHEAD`: `wid = getProgramWeekIdOffset(i, date)`; if missing, create `{ ...template, ...(getJwWolWeekCatalogEntry(wid) ?? {}), weekId: wid }` with cloned sections and `updatedAt: now()`, mark `weeksChanged`.
  4. `activeIsPast = Boolean(activeWeekId) && activeWeekId < currentWeekId` (string comparison works: same-year zero-padded weeks + year prefix).
  5. `nextActiveWeekId = activeIsPast || !activeWeekId ? currentWeekId : activeWeekId` — keeps a manually selected future week.
  6. `nextSession = s.presidingSession && s.presidingSession.weekId !== nextActiveWeekId ? null : s.presidingSession`.
  7. If nothing changed, return `{}`; otherwise `withPendingSync({ presidingConfig: { weeks, activeWeekId: nextActiveWeekId }, presidingSession: nextSession })`.
- **Where**: `web/src/lib/store.ts` `ensureActiveProgramWeek` action (line 1414).
- **Why**: Fixes carry-over (clears stale session) and seeds the 4-week buffer while honoring the user's "stay on selected week" decision.
- **Considerations**: Only trigger `withPendingSync` on actual change. Use `now()` for `updatedAt` on seeded weeks so push timestamps are sane. Clone template sections per week (`sections.map(s => ({...s, subsections: s.subsections.map(sub => ({...sub}))}))`).

### Step 2: Week-scope `addPresidingLogEntry`

- **What**: Before using `s.presidingSession`, check `s.presidingSession.weekId === (s.presidingConfig.activeWeekId ?? getProgramWeekId())`; if mismatched, treat as no current session and create a fresh one with the active week's `weekId` (same shape as `startPresidingSession`).
- **Where**: `web/src/lib/store.ts` `addPresidingLogEntry` (line 1438).
- **Why**: Prevents new timer entries from being appended to a stale previous-week session when the week changed before the store-level cleanup ran.
- **Considerations**: The `presidingSessions` update logic already handles append-vs-replace by id; keep it.

### Step 3: Fix `importData` session selection

- **What**: Replace `presidingSession: nextSessions[nextSessions.length - 1] ?? null` with the latest session whose `weekId === getProgramWeekId()` (sort by `startedAt` desc), else `null`.
- **Where**: `web/src/lib/store.ts` `importData` (line 1354).
- **Why**: Restoring from remote should not activate a session from a previous week; the active session must belong to the current week.
- **Considerations**: Sessions may lack `weekId` (legacy) — fall back to `getProgramWeekId()` via the same rule used in `migratePresidingSession`.

### Step 4: Align `migratePresidingConfig` roll path

- **What**: In the `rollToCurrentWeek` branch (lines 481–493), after resolving the current week: seed `PROGRAM_WEEKS_AHEAD` future weeks (same template+generated-entry pattern as Step 1) and set `activeWeekId` only if the prior `activeWeekId` is missing or in the past (keep future selections).
- **Where**: `web/src/lib/store.ts` `migratePresidingConfig` (lines 409–494).
- **Why**: Remote imports (`importData` → `migratePresidingConfig` with default `rollToCurrentWeek=true`) must not yank the user off a selected future week, and should still guarantee the 5-week window.
- **Considerations**: This function is also called from `setPresidingConfig` with `rollToCurrentWeek=false` — that path must remain non-seeding/non-advancing.

### Step 5: Week-scope `sessionLog` in the page

- **What**: Replace `const sessionLog = useMemo(() => session?.log ?? [], [session])` with a memo that returns: the live `session.log` if `session.weekId === activeWeekId`, otherwise the latest stored session's log for the active week (`sessions` filtered by `weekId`, sorted by `startedAt` desc), otherwise `[]`.
- **Where**: `web/src/app/(dashboard)/presiding/page.tsx` line 29.
- **Why**: Timer hydration (`useProgramTimers` reads `sessionLog`) must reflect the selected week, not the global session. This is the direct fix for "last week's data carried over".
- **Considerations**: `activeWeekId` must be derived before this memo (reorder the `activeWeek` memo above it). The memo deps: `session`, `sessions`, `activeWeekId`.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Store unit (simulated) | Config with 1 week → `ensureActiveProgramWeek()` | 5 weeks (current+4); active=current; `presidingSession` cleared if it belonged to old week |
| Store unit | Set active to future week → call `ensureActiveProgramWeek()` again | Future week stays active |
| Store unit | Stale active (past week) → `ensureActiveProgramWeek()` | Advances to current week |
| Store unit | `addPresidingLogEntry` with stale `presidingSession` | Creates fresh session with active week's `weekId` |
| Store unit | `importData` with sessions from multiple weeks | `presidingSession` = current week's session (or null) |
| Integration (manual) | Start timer in W34, switch to W35 | Timer buttons show 0:00; Session Review (Phase 3) shows only W34 |
| Compile | `npm run type-check` (in `web/`) | Passes |

### Test Integrity Constraints

- No existing automated tests exist in `web` (no test runner configured). No existing tests affected.
- `performSync`/`pushProgram` state shape must remain identical — only values change, not types.
- `startPresidingSession` behavior unchanged (still creates a fresh session for the active week).

## Rollback Strategy

- Revert `store.ts` and `page.tsx` via git. The changes are behavioral only; no schema/data migration runs automatically, so rollback is safe for persisted IndexedDB/Supabase state.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Advance rule when active week is past | Always advance / only on rollover detection | Advance when active < current | Simple, matches "real rollover" and clears stale state; future selections (active > current) are preserved |
| Clear active session on week switch | Clear / keep | Clear when week mismatches | Sessions are per-week and preserved in history; prevents cross-week timer hydration |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/lib/store.ts` | `ensureActiveProgramWeek` (1414) | Root of carry-over bug; seeds only current week, never clears session |
| `web/src/lib/store.ts` | `addPresidingLogEntry` (1438) | Appends to `s.presidingSession` regardless of week |
| `web/src/lib/store.ts` | `importData` (1354) | Sets active session to last session in array (wrong week) |
| `web/src/lib/store.ts` | `migratePresidingConfig` (481–493) | Roll path renames `default` week and forces active to current |
| `web/src/app/(dashboard)/presiding/page.tsx` | line 29 `sessionLog` | Global-session log fed to timers regardless of selected week |

### Mismatches / Notes

- Week IDs compare lexicographically within a year; cross-year boundary (e.g., `2026-W52` vs `2027-W01`) also compares correctly because the year prefix dominates. Verified against ISO week ordering.
- The page's `ensureActiveProgramWeek` effect runs every 60s; with the new "keep future selection" rule, a user parked on a future week stays there — matching the user's confirmed preference.