---
type: planning
entity: plan
plan: "comments-box-reorder"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: comments-box-reorder

## Objective

Allow reordering comment timer cards (per-week boxes) by **press-and-hold (~350ms on touch)** then dragging, within the same category/subsection group. Order persists per week and syncs like any other comments change (JSON blob â€” no DB change).

## Requirements (DoD)

- [ ] Long-press (~350ms, tolerance ~6px) on touch starts a drag; mouse drags after a small move (6px). Normal taps keep working on all card buttons.
- [ ] Cards reorder within their own group only (per-grid `DndContext` + `SortableContext`, `rectSortingStrategy`).
- [ ] Drop writes the reordered group back into the flat per-week boxes array via **slot replacement** (same positions for the category's slots; other categories untouched).
- [ ] Dragging visual: lifted card (`z-10 shadow-xl ring-2 ring-primary/40`); no conflict with existing styles.
- [ ] Auto-add and "most recent box of category" logic keep working after reorder (flat slot order == display order).
- [ ] `npm run type-check` + `npm run build` pass.

## Scope

- `web/src/components/comments/CommentsView.tsx` only.
- Uses existing deps `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (same conventions as Settings page: MouseSensor distance 6, TouchSensor delay/tolerance).

Out of scope: moving boxes across categories/subselections (user chose same-group only); reordering categories/subsections themselves.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | DnD reorder for comment boxes | [Detail](phases/phase-1.md) | completed |

## Changelog

### 2026-08-20
- Plan created (user confirmed same-group-only scope).
