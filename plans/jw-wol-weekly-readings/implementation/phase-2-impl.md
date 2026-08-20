---
type: planning
entity: implementation-plan
plan: "jw-wol-weekly-readings"
phase: 2
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 2 - Data model, store refresh & sync

> Implements [Phase 2](../phases/phase-2.md) of [jw-wol-weekly-readings](../plan.md)

## Approach

Extend the existing week model and sync paths with the Spanish reading, add a store action that fetches readings from the Phase 1 API, and add the `program_weeks.bible_reading_es` column.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/types/presiding.ts` | modify | Add `bibleReadingEs` to `ProgramWeek` + `ProgramWeekCatalogEntry`; extend static catalog W32–W34 with ES |
| `web/src/lib/store.ts` | modify | `normalizeWeek` + new `refreshProgramWeekReadings` action + migration pass-through |
| `web/src/lib/supabase.ts` | modify | Push/pull `bible_reading_es` |
| `sql/019_program_week_reading_es.sql` | create | Add column |

## Required Context

| File | Why |
|------|-----|
| `web/src/types/presiding.ts` | Current `ProgramWeek`/catalog shape |
| `web/src/lib/store.ts` | `normalizeWeek` (~line 448), `migratePresidingConfig`, actions object, `withPendingSync`, `now()` |
| `web/src/lib/supabase.ts` | `pushProgram` weeks payload (line 552), `pullProgram` week mapping (line 693) |
| `sql/014_program_schema_recovery.sql` | Reference for migration conventions (`ADD COLUMN IF NOT EXISTS`) |

## Implementation Steps

### Step 1: Types — add `bibleReadingEs`

- **What**: Add `bibleReadingEs?: string` to `ProgramWeek` (line 24) and `ProgramWeekCatalogEntry` (line 33). Extend the three static catalog entries with ES readings fetched from WOL (e.g., W34 ES = "JEREMÍAS 26-28" or actual WOL value).
- **Where**: `web/src/types/presiding.ts`.
- **Why**: Data model parity with EN reading.
- **Considerations**: Keep EN values unchanged.

### Step 2: Store — normalize + migrate pass-through

- **What**: In `normalizeWeek` (store.ts ~448) add `bibleReadingEs: typeof week.bibleReadingEs === "string" ? week.bibleReadingEs : ""`. Ensure `migratePresidingConfig`, `importData`, `setPresidingConfig`, and any week-object construction paths preserve `bibleReadingEs` (they mostly spread the raw object, so normalize is the main choke point — verify `migratePresidingConfig`'s `weeks.push` template objects and the legacy-shape migration).
- **Where**: `web/src/lib/store.ts`.
- **Why**: Field must survive persistence/restore.
- **Considerations**: `sanitizeProgramSections`/`flattenProgramSections` don't touch weeks metadata; verify `preserveLocalAssigneeNames` only touches sections.

### Step 3: Store — new `refreshProgramWeekReadings` action

- **What**: Add action:
  - For each week in `s.presidingConfig.weeks`: skip if `week.bibleReading` AND `week.bibleReadingEs` are both non-empty (unless `force`).
  - Else `fetch("/api/jw-workbook?weekId=" + week.weekId)`; on ok, merge `bibleReading`/`bibleReadingEs` into the week with `updatedAt: now()`; on failure, leave unchanged (no-op, no pending-sync).
  - Use `withPendingSync` only when at least one week changed.
  - Return a Promise (async action) — set `get()` state at the end.
- **Where**: `web/src/lib/store.ts` actions object (near `ensureActiveProgramWeek`).
- **Why**: Populates readings for seeded weeks from the live workbook.
- **Considerations**: Must be resilient: wrap each fetch in try/catch; `Promise.allSettled` for parallel fetches; never throw out of the action.

### Step 4: Sync — push/pull `bible_reading_es`

- **What**: In `pushProgram` weeks payload (supabase.ts ~552) add `bible_reading_es: week.bibleReadingEs ?? ""`. In `pullProgram` week mapping (~693) add `bibleReadingEs: String(row.bible_reading_es ?? "")`.
- **Where**: `web/src/lib/supabase.ts`.
- **Why**: Multi-device sync of the ES reading.
- **Considerations**: Column must exist before push — migration ships with the change; add a guard in push? (existing code doesn't guard columns, so migration is sufficient).

### Step 5: Migration

- **What**: Create `sql/019_program_week_reading_es.sql`: `ALTER TABLE public.program_weeks ADD COLUMN IF NOT EXISTS bible_reading_es TEXT NOT NULL DEFAULT '';`
- **Where**: `sql/019_program_week_reading_es.sql`.
- **Why**: Persistent column for the new field.
- **Considerations**: Idempotent; no RLS changes needed.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (node) | `normalizeWeek` preserves `bibleReadingEs` | Non-empty ES survives normalize |
| Unit (store sim) | `refreshProgramWeekReadings` with a stubbed fetch | Weeks lacking readings get updated; already-populated weeks skipped |
| Unit (store sim) | Fetch failure | No crash, weeks unchanged, no pending-sync spam |
| Static | Catalog W32–W34 have both EN+ES | Type-check passes |
| Compile | `npm run type-check` | Passes |

### Test Integrity Constraints

- No existing tests affected.
- Push/pull payload shape changes are additive (new field only).

## Rollback Strategy

- Revert types/store/supabase diffs; drop the migration file (column is additive and harmless to leave).

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Refresh trigger | Store action called from page / called inside `ensureActiveProgramWeek` | Separate action called from page | Keeps `ensureActiveProgramWeek` synchronous and simple |
| Force refresh | Never / manual flag | Skip when both readings present | Avoids API spam on the 60s interval |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/lib/store.ts` | `normalizeWeek` (~448) | Field pass-through choke point |
| `web/src/lib/store.ts` | actions object `ensureActiveProgramWeek` (~1430) | Where the new action lives |
| `web/src/lib/supabase.ts` | `pushProgram` (~552) / `pullProgram` (~693) | Sync payload columns |

### Mismatches / Notes

- `migratePresidingConfig` builds weeks from raw objects + template; the normalize step runs on the weeks array (`.map(normalizeWeek)`), so `bibleReadingEs` flows through if present on the raw object.
- The static catalog entries currently only have EN; ES values must be sourced from WOL during implementation (fetch once and paste).