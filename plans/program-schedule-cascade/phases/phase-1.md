---
type: planning
entity: phase
plan: "program-schedule-cascade"
phase: 1
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: Schedule helper + start/end editors + gap sync

> Part of [program-schedule-cascade](../plan.md)

## Objective

Extract the view's cascading schedule into a pure helper (adding persisted gap support), reintroduce the start/end inline editors backed by that model, and sync the new gap field.

## Acceptance Criteria

- [ ] `computeScheduleOffsets(buildS38Sections())` returns the exact current baseline: starts `[0,6,16,26,29,30,34,38,46,61,91]`, ends `[1,16,26,29,30,34,38,42,61,91,94]`, total end 94 (display order: opening, treasures children Ã—4, field children Ã—3, living children Ã—2, concluding).
- [ ] A `gapBeforeMinute` on any part/group shifts that part and all followers by the gap (e.g., gap 10 on the first living child moves it 46â†’56 and concluding 91â†’101).
- [ ] `gapForStartEdit`: current 46 â†’ desired 50 (gap 0) â‡’ 4; desired 40 â‡’ 0 (clamped); existing gap 4, current 50, desired 52 â‡’ 6.
- [ ] `durationForEndEdit`: current start 46, desired end 70 â‡’ 24; desired 40 â‡’ 1 (clamped).
- [ ] ProgramView shows Start/End tabs (EN "Start"/"End"; ES "Inicio"/"Fin") prefilled with the cascaded times; editing them and duration shifts downstream parts live.
- [ ] `gap_before_minute` synced (flatten + sectionsFromRows + legacy json mapper + SQL 020).
- [ ] Harness + `npm run type-check` + `npm run build` pass.

## Deliverables

- [ ] Helper + editors + sync + migration.

## Dependencies

| Phase | Relationship | Notes |
|-------|-------------|-------|
| â€” | â€” | Single-phase |

## Notes

- Display cascade rules to preserve exactly: +5 after the first top-level item; +4 before the top-level "living" group; children of a group are pushed sequentially.
- `gapBeforeMinute` applies: to a leaf before its push; to a group before its first child (parent carries the group gap); to each child before its push.
- The new optional field rides through store normalization via object spread; only sync mapping needs explicit additions.