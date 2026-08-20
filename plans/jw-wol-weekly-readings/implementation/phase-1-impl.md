---
type: planning
entity: implementation-plan
plan: "jw-wol-weekly-readings"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - WOL fetch + parse + API route

> Implements [Phase 1](../phases/phase-1.md) of [jw-wol-weekly-readings](../plan.md)

## Approach

Create `web/src/app/api/jw-workbook/route.ts` — a server-side Next.js route handler that, given `weekId` (ISO format `2026-W34`):

1. Computes the week's Monday via `getIsoWeekMonday(weekId)` (already exists in `types/presiding.ts`).
2. Resolves the workbook year (from the Monday) and month slug (from the Monday's month: Jan/Feb→january, Mar/Apr→march, May/Jun→may, Jul/Aug→july, Sep/Oct→september, Nov/Dec→november; ES: enero, marzo, mayo, julio, septiembre, noviembre).
3. Fetches the EN month index HTML, regex-parses `(docid, weekLabel)` pairs, matches the label's start date to the Monday, gets the docid.
4. Fetches the EN weekly page (`/en/wol/d/r1/lp-e/<docid>`) and extracts the reading from the first `<h2>` containing a `class="b"` link.
5. Repeats for ES (`/es/wol/d/r4/lp-s/<docid>`).
6. Returns `{ weekId, bibleReadingEn, bibleReadingEs }`, cached in-memory with a 24h TTL.

Parsing is regex-based with no new dependencies. All regex lives in the route file (or a small adjacent `lib/jwWorkbook.ts` helper module) so it is unit-testable.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/app/api/jw-workbook/route.ts` | create | Server route: fetch/parse/cache WOL readings |
| `web/src/lib/jwWorkbook.ts` (optional helper) | create | Extract parsing logic for testability |

## Required Context

| File | Why |
|------|-----|
| `web/src/types/presiding.ts` | `getIsoWeekMonday` helper + `PROGRAM_WEEKS_AHEAD` (existing, Phase 1 of prior plan) |
| `plans/jw-wol-weekly-readings/plan.md` | Scope/DoD |
| Live WOL structure (verified): | month index `cardLine1` divs; weekly page `<h2><a class="b"><strong>...` |

## Implementation Steps

### Step 1: Create the helper module `web/src/lib/jwWorkbook.ts`

- **What**: Export pure functions:
  - `monthSlugForMonth(monthIndex, lang)` → EN/ES workbook slug from `getMonth()` (0-based).
  - `buildIndexUrl(year, slug, lang)` → `https://wol.jw.org/en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-<year>/<slug>` for EN and `https://wol.jw.org/es/wol/library/r4/lp-s/biblioteca/guía-de-actividades/guía-de-actividades-<year>/<slug>` for ES (URL-encode the accented `guía`).
  - `parseMonthIndex(html, lang)` → `Array<{ docid: string; startDay: number; startMonth: number }>` — regex `<a href="/<lang>/wol/d/r<conf>/lp-<lib>/(\d+)"[\s\S]*?cardLine1[\s\S]*?<span class="sectionIcon"></span>([\s\S]*?)</div>` and parse the first date from the label: EN `Month DD`, ES `DD de mes`.
  - `parseReading(html)` → first `<h2` containing `class="b"`, collect all `<strong>(.*?)</strong>` inside, join with single space, trim/collapse whitespace.
  - `fetchText(url)` → `fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ..." } })`, throw on non-200.
- **Where**: `web/src/lib/jwWorkbook.ts` (new).
- **Why**: Keeps regex isolated, unit-testable.
- **Considerations**: Handle the en-dash in labels (`July 27–August 2`); ES labels like `27 de julio a 2 de agosto`; collapse `\s+`.

### Step 2: Create the route handler

- **What**: `GET /api/jw-workbook?weekId=...`:
  - Validate `weekId` with `/^\d{4}-W\d{2}$/`; else 400.
  - `const monday = getIsoWeekMonday(weekId)`; if null → 400.
  - Resolve year = `monday.getFullYear()`, month = `monday.getMonth()`.
  - Fetch EN index, find docid whose `startDay === monday.getDate()` and `startMonth === monday.getMonth()`; if none → 404.
  - Fetch EN weekly page → `bibleReadingEn`; fetch ES weekly page → `bibleReadingEs`.
  - Cache `{ weekId, bibleReadingEn, bibleReadingEs }` with 24h TTL (module-level `Map`).
  - On fetch/parse errors → 502 with `{ error }`.
- **Where**: `web/src/app/api/jw-workbook/route.ts` (new).
- **Why**: Server-side proxy required (browser CORS).
- **Considerations**: `export const dynamic = "force-dynamic"` so Next doesn't try to statically prerender the route; cache check before fetch; also cache negative results briefly to avoid hammering on 404s (or don't cache negatives — but guard with a small cooldown).

### Step 3: Verify with real WOL data

- **What**: Run a node script (or `tsx`) that imports the helper functions and asserts:
  - W34 (2026-W34, Monday Aug 17 2026) → EN "JEREMIAH 26-28", ES "JEREMÍAS 26-28" (or actual WOL value).
  - W35 (Monday Aug 24) → EN "JEREMIAH 29-31" (per WOL).
  - W36 (Monday Aug 31) → resolved via July workbook (label "August 31–September 6").
  - W38 (Monday Sep 14) → resolved via September workbook.
  - 2027-W01 (Monday Dec 28 2026) → resolves or 404s gracefully (no crash).
- **Where**: inline `node -e` or a temp script under `web/`.
- **Why**: Proves the parser against live HTML.
- **Considerations**: The repo has no test runner; use a node/tsx one-off. If `tsx` isn't available, compile the helper with `tsc` to a temp dir like the prior phase did.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (node) | `parseReading` on captured EN/ES weekly HTML | "JEREMIAH 34-35" / "JEREMÍAS 34, 35" |
| Unit (node) | `parseMonthIndex` on captured EN/ES index HTML | docids + start dates parse correctly |
| Integration (node) | Route logic for W34/W35/W36/W38 | Correct EN/ES readings from live WOL |
| Compile | `npm run type-check` | Passes |

### Test Integrity Constraints

- No existing tests affected (no test runner in repo).
- `getIsoWeekMonday`/`getProgramWeekId` behavior must not change.

## Rollback Strategy

- Delete the new route + helper file; no existing behavior touched.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Where parsing lives | Inline in route / helper module | Helper module | Testability |
| Cache negatives | Yes / No | No (brief cooldown) | Avoid stale 404s; simple |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/types/presiding.ts` | `getIsoWeekMonday` | Gives Monday from weekId |
| Live WOL (fetched) | EN/ES month index + weekly pages | Verified docids shared across languages; reading in first `class="b"` h2 |

### Mismatches / Notes

- ES weekly page splits the reading across multiple `<strong>` elements (e.g., `JEREMÍAS 34,` + `35`); join with a single space yields `JEREMÍAS 34, 35` — matches workbook display.
- 2026-W34 static catalog says "JEREMIAH 26-28" but the live WOL weekly page for that week must be checked; if WOL differs, WOL wins (source of truth).