---
type: planning
entity: phase
plan: "program-week-alignment"
phase: 1
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: Week identity & catalog generation

> Part of [program-week-alignment](../plan.md)

## Objective

Make week identity and catalog metadata fully dynamic so any ISO week ID can produce a valid Monday–Sunday JW-aligned week entry (English + Spanish ranges), and seed the default config with the current week plus four future weeks.

## Scope

### Includes

- Add ISO-week → Monday date computation (`2026-W34` → Aug 17, 2026) using the ISO "Jan 4" rule.
- Add week-range formatting for English (`AUGUST 17-23`, cross-month `JULY 27-AUGUST 2`) and Spanish (`17-23 DE AGOSTO`, cross-month `27 DE JULIO-2 DE AGOSTO`).
- Extend `getJwWolWeekCatalogEntry` to fall back to generated entries when the week ID is not in the static catalog.
- Add `getProgramWeekIdOffset(weeksAhead, date)` helper for computing the ID N weeks from a base date.
- Export a constant for how many weeks ahead to seed (4).
- Update `getDefaultPresidingConfig()` to seed the current week + 4 future weeks (instead of the hardcoded 2026-W32 week).

### Excludes (deferred to later phases)

- Store-level seeding/rollover logic (Phase 2).
- UI changes (Phase 3).
- Real JW WOL bible-reading data for future weeks.

## Prerequisites

- [ ] None (types module has no runtime dependencies)

## Deliverables

- [ ] `web/src/types/presiding.ts` contains: `getIsoWeekStartDate` (or equivalent), `formatWeekRange` helpers, extended `getJwWolWeekCatalogEntry`, `getProgramWeekIdOffset`, `PROGRAM_WEEKS_AHEAD`, and an updated `getDefaultPresidingConfig`.

## Acceptance Criteria

- [ ] `getJwWolWeekCatalogEntry("2026-W34")` returns the static entry (AUGUST 17-23).
- [ ] `getJwWolWeekCatalogEntry("2026-W35")` returns a generated entry with `weekRangeEn: "AUGUST 24-30"` and `weekRangeEs: "24-30 DE AGOSTO"`.
- [ ] `getJwWolWeekCatalogEntry("2026-W01")` returns the correct January range (cross-year/week boundary safe).
- [ ] `getDefaultPresidingConfig().weeks` has exactly 5 weeks starting at the current week (relative to today = 2026-W34 → W34..W38), and `activeWeekId` equals the current week ID.
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 2 | blocked-by | Uses generated entries + seeding constant |
| Phase 3 | blocked-by | Uses generated entries for New Week |

## Notes

- The ISO week computation in `getProgramWeekId` already yields Monday-start weeks; this phase only adds the inverse (weekId → dates) and range formatting.
- Keep the existing static catalog entries untouched for known weeks; generated entries carry `bibleReading: ""`.