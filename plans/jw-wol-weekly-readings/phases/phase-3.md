---
type: planning
entity: phase
plan: "jw-wol-weekly-readings"
phase: 3
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 3: UI display & page trigger

> Part of [jw-wol-weekly-readings](../plan.md)

## Objective

Display the weekly reading in the active language in the Program view, and trigger reading refresh when the presiding page loads.

## Scope

### Includes

- `web/src/components/presiding/ProgramView.tsx`:
  - When `lang === "es"`, prefer `bibleReadingEs` (fall back to `bibleReading`); when `lang === "en"`, use `bibleReading`.
  - Catalog entry and week-object sources both consulted (catalog wins when both available, consistent with current behavior).
- `web/src/app/(dashboard)/presiding/page.tsx`:
  - After `ensureActiveProgramWeek()` runs (mount + 60s interval), call `refreshProgramWeekReadings()` when online.

### Excludes (deferred to later phases)

- Nothing (final phase).

## Prerequisites

- [ ] Phase 2 complete (field + store action exist)

## Deliverables

- [ ] Program view shows language-appropriate reading.
- [ ] Readings refresh automatically for seeded weeks.

## Acceptance Criteria

- [ ] In English UI, W34 shows "JEREMIAH 26-28" (or WOL value).
- [ ] In Spanish UI, W34 shows the Spanish reading from WOL.
- [ ] If ES reading is missing, Spanish UI falls back to the EN reading (never blank when EN exists).
- [ ] Page trigger fires on mount and on the 60s interval, but does not spam the API (skips weeks that already have readings).
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | API source |
| Phase 2 | blocked-by | Field + store action |

## Notes

- The page currently calls `ensureActiveProgramWeek()` on mount + 60s interval; add the refresh call alongside it.
- Guard the refresh against being triggered while offline (navigator.onLine) to avoid useless requests.