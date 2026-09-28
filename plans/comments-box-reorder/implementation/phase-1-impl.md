---
type: planning
entity: implementation-plan
plan: "comments-box-reorder"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - DnD reorder for comment boxes

> Implements [Phase 1](../phases/phase-1.md) of [comments-box-reorder](../plan.md)

## Approach

Wrap each group's grid (root category + each subsection) in `DndContext`/`SortableContext` with `rectSortingStrategy`; make `BoxCard` sortable via `useSortable` (listeners on the card root, no `attributes`); on drop, reorder the group and write it back to the flat week array via slot replacement.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/components/comments/CommentsView.tsx` | modify | DnD wiring + `handleBoxDragEnd` + `BoxCard` sortable + two grid wrappers |

## Required Context

| File | Why |
|------|-----|
| `CommentsView.tsx` | `BoxCard` (root div + style at `isRunning` branch), grids at ~L829 and ~L929 (`catBoxes.map` / `subBoxes.map`), `setWeekBoxes` |
| `settings/page.tsx` L164-174, L2264-2298 | Sensor + sortable conventions to copy |

## Implementation Steps

### Step 1: Imports + sensors + handler (CommentsView)

- **What**:
  - Imports: `DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors` from `@dnd-kit/core`; `SortableContext, rectSortingStrategy, useSortable, arrayMove` from `@dnd-kit/sortable`; `CSS` from `@dnd-kit/utilities`.
  - `const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 6 } }));`
  - `handleBoxDragEnd = ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => { ... }` (type via `DragEndEvent` from core):
    1. Guard: `!over || active.id === over.id` → return.
    2. `activeBox = boxes.find(b => b.id === active.id)`; guard missing.
    3. `group = boxes.filter(b => b.categoryId === activeBox.categoryId)`.
    4. `oldIndex/newIndex` in `group` by id; guard `-1`.
    5. `reordered = arrayMove(group, oldIndex, newIndex)`.
    6. Slot replacement: `slots = boxes.map((b,i) => b.categoryId === activeBox.categoryId ? i : -1).filter(i => i >= 0)`; `next = [...boxes]`; `slots.forEach((slot,k) => { if (reordered[k]) next[slot] = reordered[k]; })`.
    7. `setWeekBoxes(next)`.
- **Why**: Persistence + same-group-only enforcement.

### Step 2: BoxCard sortable

- **What**: In `BoxCard`: `const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: box.id });`
  - Root div: add `ref={setNodeRef}` and spread `{...listeners}`.
  - Merge style: `style={{ ...(isRunning ? {} : { borderTopColor: color, borderTopWidth: 3 }), transform: CSS.Transform.toString(transform), transition }}`.
  - className: append `isDragging && "z-10 shadow-xl ring-2 ring-primary/40"` (keep everything else; inline `transition` overrides `transition-all` while dragging).
- **Why**: Lift + move + reorder visuals.

### Step 3: Grid wrappers (both sites)

- **What**: Around `{catBoxes.map(...)}`:
  ```tsx
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoxDragEnd}>
    <SortableContext items={catBoxes.map((b) => b.id)} strategy={rectSortingStrategy}>
      <div className="grid ...">...</div>
    </SortableContext>
  </DndContext>
  ```
  Same for `subBoxes`. Note `sensors`/`handleBoxDragEnd` must be in scope — `BoxCard` is module-level, but grids render inside `CommentsView` ✓.
- **Considerations**: `SortableContext` should wrap the grid div (or be inside with items). Keep the existing grid div as-is inside the context.

## Testing Plan

| Test | Expected |
|------|----------|
| Manual (touch): hold ~0.5s → drag → drop | Card moves within group; persists after reload |
| Manual: quick taps on all card buttons | Unchanged behavior |
| Manual: scroll page starting from a card | Scrolls (no accidental drag) |
| Build | type-check + build pass |

### Test Integrity Constraints

- No tests exist; reorder must not affect timers/auto-add (flat slot order == display order).

## Rollback Strategy

- Revert single file.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Per-grid vs global DndContext | per-grid / one global | per-grid | Enforces same-group-only naturally |
| Keyboard sorting | include attributes / skip | skip | Mobile-first request; avoids role changes on card |

## Reality Check

- `boxes` flat order defines display order per group (filter), so slot replacement keeps other groups' order intact and auto-add/"most recent" semantics valid.
- dnd-kit deps already installed; no new dependencies.