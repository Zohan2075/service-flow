---
type: planning
entity: plan
plan: "program-week-alignment"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: program-week-alignment

## Objective

Fix the Program/Presiding weekly data model so that saved time (timer logs / sessions) is stored and displayed per JW midweek meeting week, and the app always offers the current week plus four future weeks aligned to the JW study schedule (e.g., the week of August 17–23).

## Motivation

The user reports two problems with the Program feature:

1. **Data carry-over across weeks** — Last week's saved time appears in the current week's view. Root cause: the active session (`presidingSession`) is a single global session that is not week-scoped; `ensureActiveProgramWeek` creates the new week but leaves the old session active, so its log hydrates the current week's timer buttons. The Session Review also lists *all* weeks' sessions regardless of the selected week.

2. **No weeks available in advance** — The JW catalog (`JW_WOL_WEEKLY_PROGRAM_CATALOG`) is hardcoded to only 3 weeks (ending at Aug 23 = the current week). `ensureActiveProgramWeek` only creates the current week, never future ones, so the week selector has nothing to pick ahead. The user wants the ability to select weeks in advance and to always see four weeks ahead.

3. **Week alignment** — Weekly intervals must match the JW midweek meeting schedule (Monday–Sunday weeks, e.g., August 17–23). The existing ISO-week computation (`getProgramWeekId`) already produces Monday-start weeks and matches the catalog (2026-W34 = Aug 17–23), so alignment is correct; future weeks just need correct generated ranges instead of relying on the tiny static catalog.

## Requirements

### Functional

- [ ] Saved timer time (sessions/logs) is scoped by `weekId` and the UI shows only the active week's data.
- [ ] When the week rolls over, the active session is reset so last week's times never hydrate the current week's timer buttons.
- [ ] The week selector always contains the current week plus the next four ISO/JW weeks (current + 4 ahead).
- [ ] Future weeks show correct Monday–Sunday date ranges (English + Spanish), generated from the ISO week ID; known weeks keep their static JW metadata (bible reading).
- [ ] Manually selecting a future week persists — the app stays on the selected week and only auto-advances on a real week rollover (current week is newer than the active week).
- [ ] "New Week" creates a JW-aligned week (next ISO week) instead of an arbitrary id like `w<timestamp>`.

### Non-Functional

- [ ] No schema changes required (existing `program_weeks`/`program_sessions`/`program_timer_logs` already key by `week_id`).
- [ ] Sync/conflict logic unchanged; seeded weeks push normally like any other week.
- [ ] Language support: English and Spanish week range labels.

## Scope

### In Scope

- `web/src/types/presiding.ts` — dynamic JW catalog generation + week-range computation + default config seeding current+4.
- `web/src/lib/store.ts` — week-scoped sessions, `ensureActiveProgramWeek` seeding + rollover semantics, `importData`/migration alignment.
- `web/src/app/(dashboard)/presiding/page.tsx` — week-scoped `sessionLog` derivation.
- `web/src/components/presiding/ProgramView.tsx` — Session Review filtered by active week; JW-aligned "New Week".

### Out of Scope

- Real JW WOL bible-reading data for future weeks (only known static entries kept; generated weeks have empty `bibleReading`).
- Any change to the Comments per-week model (already keyed by `weekId`).
- Backend/SQL changes.

## Definition of Done

- [ ] `getJwWolWeekCatalogEntry` returns correct generated ranges for any ISO week not in the static catalog.
- [ ] `ensureActiveProgramWeek` seeds current + 4 future weeks and keeps a manually selected future week active.
- [ ] Timer logs from a previous week never appear in the current week's view (timer buttons hydrate from the active week's sessions only).
- [ ] Session Review lists only the active week's sessions.
- [ ] `npm run type-check` passes and the app builds.
- [ ] Manual verification: with the current week being 2026-W34 (Aug 17–23), the selector shows W34, W35, W36, W37, W38 and ranges render correctly.

## Testing Strategy

- [ ] Unit-style checks for `getJwWolWeekCatalogEntry("2026-W35")` → "AUGUST 24-30" / "24-30 DE AGOSTO" (and other boundary weeks: month-crossing, year-crossing).
- [ ] Store-level simulation: seed config with 1 week, call `ensureActiveProgramWeek`, assert 5 weeks exist and active stays on the current week; assert selecting a future week is preserved on subsequent calls.
- [ ] Manual UI check: start a timer in week W34, switch to W35 — timer buttons show 0:00; Session Review shows only W34 entries.
- [ ] Full `npm run type-check` and `npm run build`.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Week identity & catalog generation | [Detail](phases/phase-1.md) | completed |
| 2 | Week-scoped state & rollover | [Detail](phases/phase-2.md) | completed |
| 3 | ProgramView week scoping & JW-aligned New Week | [Detail](phases/phase-3.md) | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Future-week bible readings unknown | Future weeks show no bible reading until catalog extended | Keep static entries; generated entries leave `bibleReading: ""`; user can extend catalog later |
| ISO year boundary (e.g., 2026-W52 → 2027-W01) | Week ranges could mislabel if year parsing is naive | Implement ISO week→Monday computation (Jan 4 rule) and verify with unit checks |
| Manually-created legacy weeks (`w<timestamp>`) | Not JW-aligned | Leave existing ones untouched; only new weeks use ISO generation |
| Active session cleared on week switch | In-progress timer context lost when browsing another week | Acceptable: sessions are per-week and stored in history; switching back to current week starts a fresh session |

## Changelog

### 2026-08-20

- Plan created
- All 3 phases implemented and verified (type-check, build, behavioral simulations)
- Future weeks get generated Monday–Sunday ranges; bible reading is empty unless later added to the static catalog