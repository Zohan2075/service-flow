---
type: planning
entity: phase
plan: "program-week-alignment"
phase: 3
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 3: ProgramView week scoping & JW-aligned New Week

> Part of [program-week-alignment](../plan.md)

## Objective

Finish the UI: the Session Review must only show the active week's sessions, and "New Week" must create a JW-aligned week (next ISO week) instead of an arbitrary id.

## Scope

### Includes

- `web/src/components/presiding/ProgramView.tsx`:
  - Filter `sessionHistory` in `SessionReview` by the active week's `weekId` (fall back to the week-scoped `sessionLog` passed from the page).
  - Update `createWeek` to compute the next ISO week after the latest configured week and use the generated catalog entry (range labels + empty bible reading) instead of `w${Date.now()}`.
- Week selector already lists `config.weeks`; verify it renders the seeded future weeks correctly with generated ranges.

### Excludes (deferred to later phases)

- Editing/adding bible readings for future weeks in the UI.
- Any other UI polish.

## Prerequisites

- [ ] Phase 2 complete (page passes week-scoped `sessionLog`)

## Deliverables

- [ ] Session Review shows only the active week's entries.
- [ ] "New Week" creates a real ISO week entry.

## Acceptance Criteria

- [ ] With sessions for W34 and W35 present, viewing W34 shows only W34 entries in the Session Review.
- [ ] Clicking "+ New Week" when the latest week is W38 creates `2026-W39` with the range "AUGUST 31-SEPTEMBER 6" / "31 DE AGOSTO-6 DE SEPTIEMBRE".
- [ ] The week selector dropdown shows all seeded weeks with correct ranges.
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Uses generated catalog entries |
| Phase 2 | blocked-by | Depends on week-scoped `sessionLog` |

## Notes

- Session Review's fallback path (`sessionLog`) is already week-scoped by Phase 2, so the filter primarily affects the `sessionHistory` branch.
- The week selector's existing mapping already uses `w.weekRangeEn/Es`; generated entries supply those.