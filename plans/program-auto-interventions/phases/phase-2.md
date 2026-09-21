---
type: planning
entity: phase
plan: "program-auto-interventions"
phase: 2
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 2: Store auto-apply + page wiring

> Part of [program-auto-interventions](../plan.md)

## Objective

Apply the fetched workbook program to the store weeks (current + future), with strict safety rules, wired into the existing presiding-page refresh cycle.

## Scope

### Includes

- `web/src/types/presiding.ts`: optional `sourceWolDocid?: string` on `ProgramWeek` (marker that the week was auto-populated from the workbook), passed through `normalizeWeek` in the store.
- `web/src/lib/store.ts`:
  - Extend the existing refresh action (currently `refreshProgramWeekReadings`) to fetch readings AND program in one call per week, and apply the program safely.
  - Auto-apply rule (per week): must be online fetch success AND the week has NO assignee names (any section) AND NO timer/log sessions for that week AND (`sourceWolDocid` set OR sections are pristine template). Otherwise only readings update.
  - Build `PresidingSection` trees: standalone opening (group null), treasures/fieldMinistry/living group sections with subsections, concluding standalone. `titleEn`/`titleEs` zipped by part order (EN source of truth when mismatch). Deterministic section ids per week (`${weekId}-open`, `${weekId}-t-{n}`, `${weekId}-f${n}`, `${weekId}-l${n}`, `${weekId}-concl`) so repeated applications are id-stable.
  - Apply through the existing `setPresidingConfig` action (normalization computes schedule offsets, tombstones stale template sections, marks pending sync).
- `web/src/app/(dashboard)/presiding/page.tsx`: rename/point the effect call at the extended action (no new cadence â€” same mount + 60s interval, online-only).

### Excludes

- UI desc/title editing of workbook parts is already possible (standard section edit).

## Deliverables

- [ ] Pristine weeks auto-populate from the workbook in both languages; customized weeks untouched.

## Acceptance Criteria

- [ ] A seeded pristine future week shows the workbook's real interventions in Programa (opening, groups with actual parts/durations, concluding).
- [ ] A week with assignee names or timer logs is not overwritten (readings still update if missing).
- [ ] Repeated page loads don't churn tombstones (same ids reapplied only when unchanged â†’ no pending-sync spam when nothing changed).
- [ ] `npm run type-check` passes.

## Dependencies

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Parser + endpoint payload |

## Notes

- `setPresidingConfig` already handles normalization/schedule offsets/tombstones â€” reuse it rather than writing a parallel writer.
- Fetch-skip condition extends to: weeks already having readings but still pristine-and-logless should still be fetched (for program apply).
