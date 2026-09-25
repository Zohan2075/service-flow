---
type: planning
entity: plan
plan: "program-schedule-cascade"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: program-schedule-cascade

## Objective

Allow editing an intervention's **start** and **end** (alongside duration) and have every following intervention shift automatically â€” extending the current display cascade (which already shifts downstream times when a duration changes) with persisted per-intervention gaps.

## Current state (working tree, user-authored, uncommitted)

- `ProgramView` displays a **cascade**: every part starts when the previous ends; downstream times shift automatically on duration edits. Stored pins (`scheduledStartMinute`/`scheduledEndMinute`) are intentionally ignored for display.
- Built-in gaps: +5 min after the first top-level item (Song & Prayer), +4 min before the "Living as Christians" group (song).
- The **start/end inline editors were removed** â€” so "inicio/conclusiÃ³n" cannot be edited at all today.

## Requirements (DoD)

- [ ] **Duration edit** continues to shift all following parts (already true; keep).
- [ ] **Start edit**: setting a part's start time persists a **gap before that part** (`gapBeforeMinute`) so the part starts at the chosen time and every following part shifts accordingly (clamped to â‰¥ its natural cascade position).
- [ ] **End edit**: setting a part's end sets its duration to (end âˆ’ current cascaded start); following parts shift.
- [ ] The cascade computation becomes a pure, testable helper (`computeScheduleOffsets`) used by the view â€” display behavior identical to today for sections without gaps.
- [ ] Gaps persist locally and sync (new `gap_before_minute` column on `program_interventions`, migration 020).
- [ ] Single write per edit (no config clobbering); no regression to timers/session logs.
- [ ] `npm run type-check` + `npm run build` + node harness assertions pass.

## Scope

### In Scope
- `web/src/types/presiding.ts`: `PresidingSection.gapBeforeMinute?`, `computeScheduleOffsets`, `gapForStartEdit`, `durationForEndEdit`.
- `web/src/components/presiding/ProgramView.tsx`: replace inline cascade loop with the helper; reintroduce start/end inline fields wired to the helpers; keep duration editor behavior.
- `web/src/lib/supabase.ts` + `sql/020_program_gap_before_minute.sql`: sync gap column.
- Store: no behavior change needed (section spread preserves `gapBeforeMinute`); verify.

### Out of Scope
- Reverting the uncommitted cascade work in ProgramView (it stays).
- Multi-gap editing UI beyond start/end per part.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Schedule helper + start/end editors + gap sync | [Detail](phases/phase-1.md) | completed |

## Risks

| Risk | Mitigation |
|------|-----------|
| Clobbering user's uncommitted ProgramView work | Edits are additive on the current working tree; cascade loop extracted verbatim + gap support |
| Start earlier than cascade minimum | Clamp gap â‰¥ 0 (input snaps back to earliest possible) |
| Existing weeks without gaps | Helper yields identical offsets to today (harness-asserted) |

## Changelog

### 2026-08-20
- Plan created; redesigned after discovering the user-authored cascade display (pins ignored) and removed start/end editors. Model: persisted `gapBeforeMinute` for start edits; duration = end âˆ’ start for end edits.
