---
type: planning
entity: phase
plan: "jw-wol-weekly-readings"
phase: 2
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 2: Data model, store refresh & sync

> Part of [jw-wol-weekly-readings](../plan.md)

## Objective

Extend the data model and state so readings fetched from the API are stored per week, refreshed for seeded weeks, and synced to Supabase.

## Scope

### Includes

- `web/src/types/presiding.ts`:
  - Add `bibleReadingEs?: string` to `ProgramWeek`.
  - Add `bibleReadingEs?: string` to `ProgramWeekCatalogEntry`.
  - Extend static catalog entries W32–W34 with ES readings (from WOL).
- `web/src/lib/store.ts`:
  - `normalizeWeek` and any week normalization pass-through `bibleReadingEs`.
  - New action `refreshProgramWeekReadings` that, for each week in `presidingConfig.weeks` lacking `bibleReading`/`bibleReadingEs` (or where a manual refresh is requested), calls `/api/jw-workbook?weekId=...` and merges the result into the week; failure is a silent no-op.
  - Ensure `migratePresidingConfig`/`importData`/`push` paths carry `bibleReadingEs`.
- `web/src/lib/supabase.ts`:
  - `pushProgram`: include `bible_reading_es` in the `program_weeks` upsert payload.
  - `pullProgram`: read `bible_reading_es` into `ProgramWeek.bibleReadingEs`.
- New migration `sql/019_program_week_reading_es.sql`: `ALTER TABLE public.program_weeks ADD COLUMN IF NOT EXISTS bible_reading_es TEXT NOT NULL DEFAULT '';`

### Excludes (deferred to later phases)

- UI display (Phase 3).
- Page-level trigger (Phase 3).

## Prerequisites

- [ ] Phase 1 complete (API route exists)

## Deliverables

- [ ] `ProgramWeek.bibleReadingEs` exists and flows through normalization, sync push/pull.
- [ ] `refreshProgramWeekReadings` updates weeks with fetched readings.
- [ ] `program_weeks.bible_reading_es` column added via migration.

## Acceptance Criteria

- [ ] Calling `refreshProgramWeekReadings` with online fetch updates seeded weeks' `bibleReading`/`bibleReadingEs`.
- [ ] Fetch failure leaves existing readings unchanged (no crash, no pending-sync spam).
- [ ] `pushProgram` sends `bible_reading_es`; `pullProgram` restores it.
- [ ] Static catalog W32–W34 entries have both EN and ES readings.
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Store refresh calls the API |
| Phase 3 | blocked-by | UI reads the new field |

## Notes

- Keep `refreshProgramWeekReadings` cheap: skip weeks that already have both readings unless explicitly forced.
- The migration file follows the established `sql/NNN_*.sql` numbering convention (next is 019).