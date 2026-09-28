---
type: planning
entity: phase
plan: "comments-box-reorder"
phase: 1
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: DnD reorder for comment boxes

> Part of [comments-box-reorder](../plan.md)

## Acceptance Criteria

- [ ] Press-and-hold a card (~350ms) then drag â†’ card lifts and can be dropped at another position of the same group; order persists (store + reload).
- [ ] Quick taps on any card button (play/edit/reset/delete/toggle) still work; page scroll still works when dragging upward/downward from a card is not started.
- [ ] `handleBoxDragEnd` reorders only within `active`'s category; groups without change keep exact order.
- [ ] `npm run type-check` + `npm run build` pass.

## Deliverables

- [ ] Sortable grids (root + subsections) and sortable `BoxCard`.

## Dependencies

| Phase | Relationship | Notes |
|-------|-------------|-------|
| â€” | â€” | Single-phase |

## Notes

- Sensor conventions copied from `settings/page.tsx` (MouseSensor distance 6; TouchSensor delay/tolerance) but with `delay: 350` for deliberate press-and-hold.
- Slot replacement: `slots = flat.map((b,i) => b.categoryId===cat ? i : -1).filter(>=0)`; then `slots[k] = reorderedGroup[k]`.
- No store/types changes; `setWeekBoxes` already persists + marks pending sync.