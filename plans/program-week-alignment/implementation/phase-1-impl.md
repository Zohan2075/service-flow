---
type: planning
entity: implementation-plan
plan: "program-week-alignment"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - Week identity & catalog generation

> Implements [Phase 1](../phases/phase-1.md) of [program-week-alignment](../plan.md)

## Approach

Make week identity/catalog fully dynamic in `web/src/types/presiding.ts`:

1. Add an ISO-week → Monday-date computation (Jan 4 rule) so any `2026-Wnn` ID yields its Monday start.
2. Add English/Spanish range formatters (handling same-month, cross-month, and cross-year boundaries).
3. Extend `getJwWolWeekCatalogEntry` to fall back to generated entries for week IDs absent from the static catalog.
4. Add `getProgramWeekIdOffset(weeksAhead, date)` and export `PROGRAM_WEEKS_AHEAD = 4`.
5. Change `getDefaultPresidingConfig()` to seed current + 4 future weeks (instead of the hardcoded `2026-W32` week).

No store or UI changes in this phase.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/types/presiding.ts` | modify | Add dynamic week-range generation + catalog fallback; update default config seeding |

## Required Context

| File | Why |
|------|-----|
| `web/src/types/presiding.ts` | Target of all changes; contains `getProgramWeekId`, `JW_WOL_WEEKLY_PROGRAM_CATALOG`, `getDefaultPresidingConfig` |
| `web/src/lib/store.ts` (lines 409–494) | Shows how `migratePresidingConfig` consumes catalog entries and default config (contract to preserve) |
| `web/src/components/presiding/ProgramView.tsx` (line 406–409) | Shows how catalog entries are consumed in UI (`getJwWolWeekCatalogEntry` + `weekRangeEn/Es` fallback) |

## Implementation Steps

### Step 1: Add ISO week → Monday date helper

- **What**: Add `getIsoWeekMonday(weekId: string): Date | null` that parses `^(\d{4})-W(\d{2})$` and computes the Monday of that ISO week using the Jan-4 rule: `jan4 = new Date(year, 0, 4)`; `day = jan4.getDay() || 7`; Monday of week 1 = `jan4 - (day - 1)` days; add `(week - 1) * 7` days.
- **Where**: `web/src/types/presiding.ts` near `getProgramWeekId` (line ~162).
- **Why**: Inverse of the existing ISO-week computation; the source of truth for generated week ranges.
- **Considerations**: Return `null` for malformed IDs (e.g., legacy `w<timestamp>` or `default`). Use local-time date construction to match `getProgramWeekId`'s local-calendar semantics.

### Step 2: Add EN/ES range formatters

- **What**: Add `formatWeekRange(weekId: string): { weekRangeEn: string; weekRangeEs: string } | null`:
  - Compute Monday via Step 1; Sunday = Monday + 6 days.
  - EN: same month → `AUGUST 17-23`; cross-month → `JULY 27-AUGUST 2`; include year only when cross-year (`DECEMBER 28-JANUARY 3`).
  - ES: same month → `17-23 DE AGOSTO`; cross-month → `27 DE JULIO-2 DE AGOSTO`; cross-year similarly.
  - Use month-name arrays (`MONTHS_EN`, `MONTHS_ES`).
- **Where**: `web/src/types/presiding.ts` (module-level constants + function).
- **Why**: The catalog format used everywhere (`ProgramWeek.weekRangeEn/Es`, ProgramView header, week selector).
- **Considerations**: Match the existing uppercase style; verify against known catalog entries (W32→`AUGUST 3-9`, W34→`AUGUST 17-23`).

### Step 3: Extend `getJwWolWeekCatalogEntry` with generated fallback

- **What**: When `JW_WOL_WEEKLY_PROGRAM_CATALOG[weekId]` is missing, return `{ weekId, ...formatWeekRange(weekId), bibleReading: "" }` (or `undefined` if the weekId cannot be parsed).
- **Where**: `web/src/types/presiding.ts` lines 62–64.
- **Why**: Future weeks need valid ranges without hardcoding every week.
- **Considerations**: Keep static entries untouched; they win over generated ones.

### Step 4: Add week-offset helper + constant

- **What**: Add `export const PROGRAM_WEEKS_AHEAD = 4;` and `export function getProgramWeekIdOffset(weeksAhead: number, date = new Date()): string` that clones the date, adds `weeksAhead * 7` days, and returns `getProgramWeekId(cloned)`.
- **Where**: `web/src/types/presiding.ts` near `getProgramWeekId`.
- **Why**: Needed by store seeding (Phase 2) and default-config seeding (Step 5).
- **Considerations**: Clone the input date before mutating.

### Step 5: Update `getDefaultPresidingConfig()` to seed current + 4 future weeks

- **What**: Build `weeks` from the current week (`getProgramWeekId()`) through `PROGRAM_WEEKS_AHEAD` weeks ahead using the existing S-38 template sections (clone sections per week so weeks don't share references), pulling metadata via `getJwWolWeekCatalogEntry`. Set `activeWeekId` to the current week ID.
- **Where**: `web/src/types/presiding.ts` lines 200–217.
- **Why**: Initial config must already contain the full 5-week window; `ensureActiveProgramWeek` (Phase 2) then only fills gaps on rollover.
- **Considerations**: Use `weekId`-based cloning for `sections` (the DEFAULTS template's `mk()` already produces fresh objects, but re-map to be safe). Keep the existing bible-reading casing (`JEREMIAH 22, 23` for W32) via the catalog.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (node/ts-node) | `getJwWolWeekCatalogEntry("2026-W34")` | Returns static entry `AUGUST 17-23` |
| Unit | `getJwWolWeekCatalogEntry("2026-W35")` | Generated `AUGUST 24-30` / `24-30 DE AGOSTO`, `bibleReading: ""` |
| Unit | `getJwWolWeekCatalogEntry("2026-W01")` and a cross-year week | Correct January/December ranges (Jan 4 rule, cross-year safe) |
| Unit | `getDefaultPresidingConfig()` with today=2026-08-20 | 5 weeks: W34..W38; activeWeekId=`2026-W34`; each week has sections |
| Compile | `npm run type-check` (in `web/`) | Passes |

### Test Integrity Constraints

- No existing automated tests exist for this module (`web` has no test runner; only `type-check`/`build`/`lint`). No existing tests affected.
- `getProgramWeekId` behavior must not change — verify current week mapping remains 2026-W34 for Aug 20, 2026.

## Rollback Strategy

- Revert `web/src/types/presiding.ts` via git; Phase 1 is additive (new helpers) + one default-config change. The default-config change is only observable on fresh init/reset, so reverting restores prior behavior.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Weeks-ahead count | 3 / 4 / 5 | 4 | User requirement: "four weeks to be displayed in advance at all times" |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/types/presiding.ts` | `getProgramWeekId` (line 162) | Existing ISO-week computation to mirror (local-calendar, Monday-based) |
| `web/src/types/presiding.ts` | `JW_WOL_WEEKLY_PROGRAM_CATALOG` (line 41) | Static catalog to keep + fall back from |
| `web/src/types/presiding.ts` | `getDefaultPresidingConfig` (line 200) | Hardcoded W32 default to replace with dynamic seeding |
| `web/src/lib/store.ts` | `migratePresidingConfig` (lines 409–494) | Consumer contract: catalog entries + default config shape |

### Mismatches / Notes

- Static catalog only covers W32–W34; after Aug 23, 2026 every week is generated. This matches scope (no real JW bible-reading data available offline for future weeks).
- `getProgramWeekId` uses ISO weeks; JW midweek meetings run Monday–Sunday, so alignment holds (verified: 2026-W34 = Aug 17–23, a Monday start).