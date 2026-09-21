---
type: planning
entity: plan
plan: "program-auto-interventions"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: program-auto-interventions

## Objective

Automatically populate the Program view's weekly interventions (parts, groups, durations) from the JW WOL meeting workbook (GuÃ­a de actividades / Life and Ministry Meeting Workbook) at jw.org/wol.jw.org, in both English and Spanish, so the current and upcoming weeks always reflect the real weekly arrangements (e.g., a week with 8 or 10 interventions shows exactly those parts) instead of the static S-38 template.

## Motivation

The Program currently seeds every week with the same default S-38 template (Opening, Treasure Talk, Gems, Reading, Conductor's Comments, Starting a Conversation, Following Up, Talk, Local Needs, Congregation Bible Study, Concluding). Real weeks differ â€” the workbook enumerates the actual parts with actual durations each week. The app already fetches the weekly workbook page for the Bible reading (reading fetch built earlier); the same HTML contains the full weekly program. The user wants the Program to mirror it automatically for current + future weeks.

## Requirements

### Functional

- [ ] The weekly workbook page (EN + ES) is parsed into the real program structure: opening comments part, the 3 groups ( treasures / "Seamos mejores maestros" / living ) with their numbered parts and minute durations, and the concluding comments part.
- [ ] `/api/jw-workbook?weekId=...` returns the program parts in both languages alongside the existing Bible readings.
- [ ] The store auto-applies the fetched program to the corresponding ProgramWeek for the current + 4 future weeks, replacing the static template sections.
- [ ] Safety: a week is only auto-replaced when it carries no user customization â€” no assignee names AND no timer logs for that week AND its sections are still the pristine template (or a previous auto-applied program for the same week). Customized weeks are never overwritten.
- [ ] Both languages populate the same sections: `titleEn` from the EN workbook, `titleEs` from the ES workbook (zipped by part order).
- [ ] Timer-role logic keeps working (Bible reading â†’ Lector+Presidente; field-ministry parts â†’ Asignado+Presidente; others â†’ Asignado) via the existing `getTimerRoles` rules.
- [ ] Weeks with no workbook data yet keep the template; failed fetches are silent no-ops.

### Non-Functional

- [ ] No SQL schema changes (weekly program travels through sections/prog interventions as today).
- [ ] Deterministic section ids per week so repeated fetches don't churn tombstones.
- [ ] Server caching unchanged (24h TTL); offline behavior unchanged (pristine weeks stay as template until a successful fetch).

## Scope

### In Scope

- `web/src/lib/jwWorkbook.ts` â€” parse the weekly program (groups + parts + durations) from the already-fetched weekly page HTML, EN and ES.
- `web/src/app/api/jw-workbook/route.ts` â€” return program data in the endpoint response.
- `web/src/types/presiding.ts` â€” optional `sourceWolDocid` marker on ProgramWeek (how auto-apply tracks applied weeks; local-only).
- `web/src/lib/store.ts` â€” merge readings+program refresh into one action with the auto-apply safety rules; rebuild `PresidingSection` trees from workbook parts; deterministic section ids.
- `web/src/app/(dashboard)/presiding/page.tsx` â€” refresh trigger unchanged (already calls the refresh action); action name/behavior extended.

### Out of Scope

- Workbook part *descriptions* (e.g., "HOUSE TO HOUSE. Offer a Bible study.") â€” not present in the current section model; scope deferred.
- Manual "force refresh" UI control.
- Editing/conflict UI for customized weeks.

## Definition of Done

- [ ] Parser returns, for a known week (e.g., 2026-W38): opening 1 min, treasures parts 10/10/4, field-ministry parts 2/2/3/4, living parts 6/9/30, concluding 3 â€” matching the live workbook.
- [ ] Endpoint returns programEn/programEs arrays alongside readings.
- [ ] A pristine future week auto-populates with exactly the workbook's interventions (visible in Programa) in both languages.
- [ ] A week with user assignments or timer logs is never overwritten.
- [ ] `npm run type-check` and `npm run build` pass.

## Testing Strategy

- [ ] Parser unit checks against live WOL HTML (EN + ES) asserting group ordering, part count, durations.
- [ ] Store simulation: pristine week replaced; customized week untouched.
- [ ] Type-check + build.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Workbook program parser + API response | [Detail](phases/phase-1.md) | completed |
| 2 | Store auto-apply + page wiring | [Detail](phases/phase-2.md) | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| WOL markup variations (missing duration, extra songs) | Dropped/extra parts | Tolerant parsing: skip items without durations; songs (`Song 121` h3) ignored; missing program â†’ keep template |
| User pre-assigned names on future weeks | Assignments lost on replace | Auto-apply skips weeks with any assignee names or logs |
| Modern timer logs tied to template section ids | Orphaned log entries | Weeks containing logs are never auto-replaced |
| EN/ES part-count mismatch | Garbled zip | Zip by order only when counts match; else ES titles left empty |
| 24h cache keeps stale program | Stale weekly data | Acceptable; docid changes propagate next fetch cycle; force refresh deferred |

## Changelog

### 2026-08-20

- Plan created
