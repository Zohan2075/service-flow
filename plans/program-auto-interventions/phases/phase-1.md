---
type: planning
entity: phase
plan: "program-auto-interventions"
phase: 1
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: Workbook program parser + API response

> Part of [program-auto-interventions](../plan.md)

## Objective

Extend `lib/jwWorkbook.ts` to parse the full weekly meeting program (in English and Spanish) from the already-fetched workbook weekly pages, and expose it through `/api/jw-workbook`.

## Scope

### Includes

- New `parseProgram(html, lang)` in `web/src/lib/jwWorkbook.ts` returning `{ opening, groups, concluding }` where:
  - `Part = { title: string; minutes: number }`
  - `opening` â€” the first music-icon `<h3>` ("Song N and Prayer | Opening Comments (1 min.)") before the first group.
  - `groups` â€” ordered array of `{ group: "treasures" | "fieldMinistry" | "living"; parts: Part[] }`, detected by the group `<h2>` STRONG text keywords: treasures "TREASURES FROM GOD"/"TESOROS DE LA BIBLIA"; fieldMinistry "APPLY YOURSELF"/"SEAMOS MEJORES"; living "LIVING AS CHRISTIANS"/"NUESTRA VIDA CRISTIANA".
  - Each numbered part: `<strong>N. Title</strong>` with duration parsed from its following `<p>(N min[s].)</p>` block (ES plural "mins."). Strip the leading number and trailing punctuation decorations from the title; skip song-only `<h3>` ("Song 121"/"CanciÃ³n 121", no number/duration).
  - `concluding` â€” the h3 whose STRONG starts with "Concluding Comments"/"Palabras de conclusiÃ³n" with inline "(3 min.)".
- Extend the endpoint response: `{ weekId, bibleReadingEn, bibleReadingEs, programEn, programEs }` where program arrays are flat ordered part lists (`{ group, title, minutes }`, including opening/concluding (group `null`)).
- Reuse the already-fetched EN/ES weekly HTML and the existing cache/TTL machinery (cache the program with the reading result).

### Excludes (later phases)

- Store application logic and page wiring (Phase 2).

## Deliverables

- [ ] `parseProgram` + endpoint extension implemented and live-verified.

## Acceptance Criteria

- [ ] For 2026-W38 (docid 202026253), EN parse yields opening 1 min; treasures parts 10/10/4 ("Jehovah Rewards Faithful Obedience", "Spiritual Gems", "Bible Reading"); field ministry 2/2/3/4; living 6/9/30; concluding 3.
- [ ] ES parse yields the matching Spanish parts.
- [ ] The endpoint returns programEn/programEs for a requested weekId.
- [ ] Existing reading behavior unchanged.
- [ ] `npm run type-check` passes.

## Dependencies

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 2 | blocked-by | Store consumes endpoint payload |

## Notes

- Durations in the HTML appear as "(10 min.)" inside a `<p>` following each part `<h3>`; opening/concluding carry the duration inline in the `<h3>`. ES uses plural "(4 mins.)".
- Reuse `decodeEntities`/`collapseWhitespace` helpers.
