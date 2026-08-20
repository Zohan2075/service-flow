---
type: planning
entity: phase
plan: "jw-wol-weekly-readings"
phase: 1
status: pending
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: WOL fetch + parse + API route

> Part of [jw-wol-weekly-readings](../plan.md)

## Objective

Build the server-side pipeline that converts an ISO week ID into the English + Spanish Bible reading from the JW WOL meeting workbook, exposed as a Next.js API route with in-memory caching.

## Scope

### Includes

- New route handler `web/src/app/api/jw-workbook/route.ts`.
- Parser helpers (regex-based) for:
  - Month index page (EN + ES): extract `(docid, weekLabel)` pairs from `cardLine1` divs.
  - Weekly page (EN + ES): extract the reading from the first `<h2>` containing a `class="b"` link (EN single `<strong>`, ES joined across multiple `<strong>`).
- Week→month resolution: given the week's Monday, pick the correct workbook year + month slug (`january..november` EN, `enero..noviembre` ES).
- In-memory TTL cache keyed by weekId (e.g., 24h).
- Error handling: 400 invalid weekId, 502 on WOL fetch/parse failure, 404 when week not found.

### Excludes (deferred to later phases)

- Store/data-model changes (Phase 2).
- UI display and page trigger (Phase 3).

## Prerequisites

- [ ] None (route handler is self-contained; uses `getIsoWeekMonday` from `types/presiding.ts` which already exists)

## Deliverables

- [ ] `web/src/app/api/jw-workbook/route.ts` returns `{ weekId, bibleReadingEn, bibleReadingEs }`.

## Acceptance Criteria

- [ ] `GET /api/jw-workbook?weekId=2026-W34` → `bibleReadingEn: "JEREMIAH 26-28"`, `bibleReadingEs: "JEREMÍAS 26-28"` (or whatever the workbook states).
- [ ] `GET /api/jw-workbook?weekId=2026-W35` → `bibleReadingEn: "JEREMIAH 29-31"` (per WOL).
- [ ] `GET /api/jw-workbook?weekId=2026-W36` (Monday Aug 31) resolves via the July workbook (not September).
- [ ] `GET /api/jw-workbook?weekId=2027-W01` resolves via the 2026 workbook November/December pages if applicable (year-boundary safe).
- [ ] Invalid weekId (`foo`, `default`) → 400.
- [ ] A week not present in the workbook (e.g., far-future) → 404/502 without crashing.
- [ ] Repeated calls hit the cache (no duplicate WOL fetches).

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 2 | blocked-by | Consumes the API route |
| Phase 3 | blocked-by | Consumes the API route via store |

## Notes

- Docids are shared across languages (verified: `202026253` works for EN and ES weekly pages).
- Use Node's built-in `fetch`; set a browser-like User-Agent header to be safe.
- Parser must be tolerant to whitespace/newlines in the HTML.