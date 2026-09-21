---
type: planning
entity: implementation-plan
plan: "program-auto-interventions"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - Workbook program parser + API response

> Implements [Phase 1](../phases/phase-1.md) of [program-auto-interventions](../plan.md)

## Approach

The weekly page HTML (already fetched per language inside `getWorkbookReading`) contains the entire weekly program as ordered `<h3>` parts under three group `<h2>` banners. Add `parseProgram(html)` returning structured parts, expose it in the endpoint response, and cache it with the existing reading cache.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/lib/jwWorkbook.ts` | modify | Add `parseProgram`, extend `WorkbookResult` with `programEn`/`programEs`, parse from the already-fetched weekly HTML |
| `web/src/app/api/jw-workbook/route.ts` | modify | No change needed if route returns the full result object (verify) |

## Required Context

| File | Why |
|------|-----|
| `web/src/lib/jwWorkbook.ts` (full current file) | Existing helpers (`decodeEntities`, `collapseWhitespace`, `parseMonthIndex`, `parseReading`, `fetchText`, `getWorkbookReading` + cache), Page HTML structure knowledge |
| `web/src/app/api/jw-workbook/route.ts` | Response mapping to extend |

## Implementation Steps

### Step 1: Add `parseProgram(html: string): ParsedProgram`

- **What**: Exported helper. Walk the article HTML top-to-bottom:
  1. Split into tokens of interest: iterate `<h2 ...>...</h2>` and `<h3 ...>...</h3>` matches in document order (regex loop, like `parseReading`).
  2. Group detection: an `<h2>` whose STRONG/txt matches group keywords — `TREASURES FROM GOD` / `TESOROS DE LA BIBLIA` → `treasures`; `APPLY YOURSELF` / `SEAMOS MEJORES` → `fieldMinistry`; `LIVING AS CHRISTIANS` / `NUESTRA VIDA CRISTIANA` → `living`. (h2 group headers contain a `<strong>NAME</strong>`; other h2s in the page body also exist — only accept these keyword hits.)
  3. Part `<h3>` handling:
     - Extract the STRONG text ("N. Title"), or full h3 text when rich markup. Decode entities, collapse whitespace.
     - Strip leading `N.` numbering (e.g., `1. `, `10. `) — regex `/^(\d+)[.)\s]+/`.
     - Duration: search the h3's own text AND the following `<p ...>(...)` block for `/\((\d+)\s+mins?\.?\)/i` (ES plural "mins", EN "min"). Items without a duration are skipped EXCEPT opening/concluding keyword items (they carry inline durations).
     - Skip song headers: STRONG text matching `/^(Song|Canción)\s+\d+/` and lacking a number-dot prefix/duration.
  4. `opening`: part whose title contains "Opening Comments"/"Palabras de introducción" (duration 1 carried inline).
  5. `concluding`: title starting "Concluding Comments"/"Palabras de conclusión" (inline duration 3).
- **Why**: Derives the real weekly arrangement from the live HTML.
- **Where**: `web/src/lib/jwWorkbook.ts`.
- **Considerations**: Tolerant to EN/ES markup nuances; never throw — return best-effort arrays.

### Step 2: Extend `WorkbookResult` + `getWorkbookReading`

- **What**: Extend `WorkbookResult` with `programEn: WorkbookPart[]` and `programEs: WorkbookPart[]` where `WorkbookPart = { group: "treasures" | "fieldMinistry" | "living" | null; title: string; minutes: number }`. Flatten `parseProgram` results in order (opening null-group, groups with parts, concluding null-group). Reuse the EN/ES HTML already fetched (no extra requests). ACTIONS: if program arrays are empty → still cache (reading worked), and the store (Phase 2) keeps the template.
- **Where**: `web/src/lib/jwWorkbook.ts` `getWorkbookReading` (lines ~143-185).
- **Considerations**: Keep the same cache/TTL/INVALID_WEEK/WEEK_NOT_FOUND contract; the земля readings remain the deliverable when the program parse is empty.

### Step 3: Endpoint (usually no change)

- **What**: Verify `route.ts` returns the entire result object (`NextResponse.json(result)`) — if so, programEn/programEs flow automatically; only update the route doc comment.
- **Where**: `web/src/app/api/jw-workbook/route.ts`.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (node, compiled to temp dir) | `parseProgram(enHtml, "en")` + ES for the live 2026-W38 page | Opening 1; treasures parts [10,10,4]; fieldMinistry [2,2,3,4]; living [6,9,30]; concluding 3 |
| Unit | ES variant of the same docid | Matching Spanish titles, same lengths |
| Integration | Endpoint response contains programEn/programEs | Via compiled orchestrator call |
| Compile | `npm run type-check` | Passes |

### Test Integrity Constraints

- Existing tests none; reading parsing behavior (`parseReading`) must remain unchanged — its assertions already covered in the Phase-1 verify of the readings feature.

## Rollback Strategy

- Revert jwWorkbook.ts/route.ts; readings revert to original behavior.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Song-only h3 items | Include as parts / skip | Skip | No duration, not a timed part; app adds songs separately |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/lib/jwWorkbook.ts` | `parseReading` (line ~110) | h2/h3/strong split parsing precedent |
| Live WOL HTML (fetched earlier conversation) | h3/p group structure | Parsing contract verified for EN and ES |

### Mismatches / Notes

- ES plural "mins." handled by plural regex.
- The living group's `Song 121` h3 lacks duration — must be skipped.
- Some numbered parts embed citations/ink links (e.g., "(4 min.) Jer 35:1-14") — duration extraction must be tolerant of trailing text.