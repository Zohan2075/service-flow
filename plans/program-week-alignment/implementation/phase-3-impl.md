---
type: planning
entity: implementation-plan
plan: "program-week-alignment"
phase: 3
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 3 - ProgramView week scoping & JW-aligned New Week

> Implements [Phase 3](../phases/phase-3.md) of [program-week-alignment](../plan.md)

## Approach

Finish the UI layer in `web/src/components/presiding/ProgramView.tsx`:

1. Filter the Session Review's `sessionHistory` by the active week's `weekId` so only the selected week's sessions are listed.
2. Change `createWeek` to compute the next ISO week after the latest configured week and build it from the generated catalog entry (proper ranges) instead of `w${Date.now()}`.

No store or page changes in this phase (Phase 2 already supplies a week-scoped `sessionLog`).

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/components/presiding/ProgramView.tsx` | modify | Session Review week filter + JW-aligned New Week |

## Required Context

| File | Why |
|------|-----|
| `web/src/components/presiding/ProgramView.tsx` lines 416–436 | `createWeek` (arbitrary id) and `deleteWeek` |
| `web/src/components/presiding/ProgramView.tsx` lines 1019–1086 | `SessionReview` (flattens ALL sessions) |
| `web/src/components/presiding/ProgramView.tsx` lines 394–414 | `activeWeek` derivation + `updateActiveWeek` |
| `web/src/types/presiding.ts` | `getJwWolWeekCatalogEntry`, `getDefaultWeek`, `getProgramWeekIdOffset` (Phase 1) |
| `web/src/app/(dashboard)/presiding/page.tsx` line 147 | `sessionHistory={sessions}` prop passed to ProgramView |

## Implementation Steps

### Step 1: Filter Session Review by active week

- **What**: In `SessionReview`, add an `activeWeekId: string | null` prop. Compute `weekSessions = sessionHistory.filter((s) => s.weekId === activeWeekId)` and build `reviewEntries` from `weekSessions` (fall back to `sessionLog` entries when `weekSessions` is empty). Pass `activeWeekId={activeWeek?.weekId ?? null}` from `ProgramView` (line 743 call site).
- **Where**: `web/src/components/presiding/ProgramView.tsx` — `SessionReview` definition (1019) and call site (743).
- **Why**: The review currently lists every week's sessions, which reads as "last week's data carried over into this week".
- **Considerations**: Keep the `sessionLog` fallback path (Phase 2 already scopes it to the active week). Legacy sessions without `weekId` will be excluded when a real week is active — acceptable, matches the week-scoped model.

### Step 2: JW-aligned "New Week"

- **What**: Replace `createWeek` (line 424) so that instead of `w${Date.now()}` it:
  1. Finds the maximum existing ISO week ID in `config.weeks` (parse `^(\d{4})-W(\d{2})$`; ignore `default`/`w<timestamp>` ids).
  2. If none found, start from the current week (`getProgramWeekId()`).
  3. Compute the next week by adding 7 days to the Monday of the max week (or to the current date), then `getProgramWeekId` on that date.
  4. Build the week via `{ ...getDefaultWeek(), ...(getJwWolWeekCatalogEntry(id) ?? {}), weekId: id }`.
- **Where**: `web/src/components/presiding/ProgramView.tsx` `createWeek` (line 424).
- **Why**: Manual week creation should produce schedule-aligned weeks, not opaque ids.
- **Considerations**: Import `getProgramWeekId`/`getJwWolWeekCatalogEntry` (already imported: `getJwWolWeekCatalogEntry` at line 22; add `getProgramWeekId`). The week selector already renders `w.weekRangeEn/Es` — generated entries provide those. `getDefaultWeek()` provides the S-38 section template.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Manual UI | Sessions exist for W34 and W35; view W34 | Session Review lists only W34 entries |
| Manual UI | Click "+ New Week" with latest week W38 | Creates `2026-W39` with range "AUGUST 31-SEPTEMBER 6" / "31 DE AGOSTO-6 DE SEPTIEMBRE" |
| Manual UI | Open week selector | Shows seeded weeks W34..W38 with correct ranges |
| Compile | `npm run type-check` (in `web/`) | Passes |

### Test Integrity Constraints

- No existing automated tests exist in `web`. No existing tests affected.
- Existing weeks (including legacy `w<timestamp>` ones) must remain selectable — the filter only changes review entries, not the week list.

## Rollback Strategy

- Revert `web/src/components/presiding/ProgramView.tsx` via git. UI-only change; no data implications.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| New Week when no ISO week exists yet | Start from current week / arbitrary | Start from current week | Aligns with schedule; guaranteed by Phase 2 seeding anyway |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/components/presiding/ProgramView.tsx` | `SessionReview` (1019) | Flat-maps all `sessionHistory` regardless of week |
| `web/src/components/presiding/ProgramView.tsx` | `createWeek` (424) | Uses `w${Date.now()}` — non-aligned ids |
| `web/src/components/presiding/ProgramView.tsx` | call site (743) | Where `activeWeekId` must be threaded into `SessionReview` |
| `web/src/types/presiding.ts` | `getJwWolWeekCatalogEntry` | Generated fallback provides ranges for arbitrary ISO weeks |

### Mismatches / Notes

- `sessionHistory` is passed as all sessions from the page (line 147); filtering must happen inside `SessionReview` because the component owns the flatten logic.
- Week selector dropdown already handles arbitrary week ids (`w.weekId === activeWeek?.weekId` check at line 565), so seeded weeks and legacy weeks coexist.