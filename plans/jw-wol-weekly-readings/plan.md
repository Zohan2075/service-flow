---
type: planning
entity: plan
plan: "jw-wol-weekly-readings"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: jw-wol-weekly-readings

## Objective

Fetch the weekly Bible reading for each program week from the JW Watchtower ONLINE LIBRARY (WOL) meeting workbook, in both English and Spanish, so the reading shown in the Program view (e.g., "JEREMIAH 34-35" / "JEREMÍAS 34, 35") updates automatically from the live workbook instead of relying only on the small static catalog.

## Motivation

The user wants the weekly Bible-reading assignment to appear for the current and future weeks (the static catalog only covers 3 weeks and only in English). They explicitly asked that readings be sourced from `https://wol.jw.org/en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-2026` and updated based on that page. The app is bilingual, so both English and Spanish readings should be supported.

Browser clients cannot fetch WOL directly (CORS), so we need a server-side Next.js API route that fetches/parses WOL and returns the reading for a given ISO week.

## Requirements

### Functional

- [ ] A server-side API route (`GET /api/jw-workbook?weekId=2026-W35`) returns `{ weekId, bibleReadingEn, bibleReadingEs }` for the given ISO week.
- [ ] The route determines the workbook month index page (English + Spanish) from the week's Monday, finds the matching weekly docid, fetches the weekly page, and extracts the reading.
- [ ] Readings are cached server-side (in-memory TTL) to avoid hammering WOL.
- [ ] `ProgramWeek` gains `bibleReadingEs`; `ProgramWeekCatalogEntry` gains `bibleReadingEs` (static fallback).
- [ ] The store refreshes readings for seeded weeks (current + 4 ahead) from the API when online, persisting results locally.
- [ ] The Program view displays the reading in the app's active language (EN → `bibleReading`, ES → `bibleReadingEs`, with fallback to EN when ES missing).
- [ ] Pushed/synced weeks carry `bible_reading_es` (new column + push/pull).
- [ ] Static catalog retains its known EN entries and gains ES readings for known weeks.

### Non-Functional

- [ ] No regression to the week-alignment behavior delivered previously (current + 4 future weeks, rollover semantics).
- [ ] Offline behavior preserved: readings already fetched remain available (persisted locally); failed fetches are silent/no-op.
- [ ] No new runtime npm dependencies (regex-based parsing on server).
- [ ] Type-check and build pass.

## Scope

### In Scope

- New Next.js API route: `web/src/app/api/jw-workbook/route.ts` (server-side fetch + parse + cache).
- `web/src/types/presiding.ts`: add `bibleReadingEs` to `ProgramWeek` and `ProgramWeekCatalogEntry`; extend static catalog with ES readings for known weeks (W32–W34).
- `web/src/lib/store.ts`: `normalizeWeek` carries `bibleReadingEs`; new `refreshProgramWeekReadings` action; migration/normalization pass-through.
- `web/src/app/(dashboard)/presiding/page.tsx`: trigger reading refresh for seeded weeks (online).
- `web/src/components/presiding/ProgramView.tsx`: language-aware reading display.
- `web/src/lib/supabase.ts`: push/pull `bible_reading_es` for `program_weeks`.
- New SQL migration `sql/019_program_week_reading_es.sql` (add column).

### Out of Scope

- Fetching anything other than the weekly Bible reading (no section titles, no timers, no songs).
- Real-time push notifications when the workbook updates.
- Multi-language support beyond EN/ES.
- Changes to the WOL source itself.

## Definition of Done

- [ ] `GET /api/jw-workbook?weekId=2026-W35` returns `bibleReadingEn: "JEREMIAH 34-35"` and `bibleReadingEs: "JEREMÍAS 34, 35"`.
- [ ] API returns 400 for invalid weekIds, 502/404 for unresolvable weeks.
- [ ] The store refreshes readings for the 5 seeded weeks on the presiding page and persists them.
- [ ] Program view shows the correct-language reading.
- [ ] `program_weeks.bible_reading_es` exists; push/pull round-trips it.
- [ ] `npm run type-check` and `npm run build` pass.

## Testing Strategy

- [ ] API route behavior: call the route logic directly with a known week (2026-W34 / W35 / W38) and assert the reading strings.
- [ ] Parser unit checks against captured WOL HTML snippets (EN month index, ES month index, EN weekly page, ES weekly page).
- [ ] Store simulation: `refreshProgramWeekReadings` updates weeks with fetched readings; failures are no-ops.
- [ ] Full type-check + build.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | WOL fetch + parse + API route | [Detail](phases/phase-1.md) | completed |
| 2 | Data model, store refresh & sync | [Detail](phases/phase-2.md) | completed |
| 3 | UI display & page trigger | [Detail](phases/phase-3.md) | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| WOL HTML structure changes | Parsing breaks | Regex isolated in one module with unit checks; API returns 502 and app keeps existing readings |
| WOL rate limiting / availability | Fetches fail or are slow | Server-side in-memory TTL cache; refresh only for missing readings; offline no-op |
| Docid shared between languages | One docid lookup per language pair | Confirmed: same docid (e.g., 202026253) serves EN `/en/wol/d/r1/lp-e/<id>` and ES `/es/wol/d/r4/lp-s/<id>` |
| Month boundary (e.g., week spans Aug 31–Sep 6) | Wrong month page looked up | Resolve month page from the week's Monday (2026-W36 Monday = Aug 31 → July workbook) |
| Year boundary (week 1 of 2027) | Wrong workbook year | Resolve workbook year from the Monday's year |
| Reading displayed in ES while week ranges stay EN/ES | Inconsistent display | ES view shows `bibleReadingEs` (fallback EN); EN view shows `bibleReading` |

## Changelog

### 2026-08-20

- Plan created
- All 3 phases implemented, verified against live WOL, and committed (`8eb904f`)