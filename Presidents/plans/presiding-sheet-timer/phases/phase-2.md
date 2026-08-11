---
type: planning
entity: phase
plan: "presiding-sheet-timer"
phase: 2
status: pending
created: "2026-08-04"
updated: "2026-08-04"
---

# Phase 2: Presiding Sheet

> Part of [presiding-sheet-timer](../plan.md)

## Objective

Build the presiding sheet UI where the user configures the meeting program: view/edit all sections with their titles (EN + ES), durations, optional assignee names, and add/remove subsections under "Apply Yourself to the Field Ministry". All changes persist to localStorage.

## Scope

### Includes

- Default S-38 meeting structure loaded on first visit (if no saved config exists):
  - Opening Comments (1 min)
  - Treasures From God`s Word (10 min)
  - Spiritual Gems (10 min)
  - Bible Reading (4 min)
  - Apply Yourself to the Field Ministry (15 min) -- expandable with subsections
  - Living as Christians (15 min)
  - Congregation Bible Study (30 min)
  - Concluding Comments (3 min)
- Each section row displays: title, duration, optional assignee name
- Inline editing: tap a field to edit title (EN + ES), duration (number input), assignee name
- "Add subsection" button under Field Ministry to add child sections
- "Add section" button at the bottom of the list
- Remove section button (with confirmation)
- Section list is scrollable within the mobile layout

### Excludes (deferred to later phases)

- Timer display or timer controls (Phase 3)
- Meeting execution mode (Phase 3)

## Prerequisites

- [ ] Phase 1 complete (app shell, i18n, data layer, types)

## Deliverables

- [ ] Presiding sheet page with all default S-38 sections rendered
- [ ] Edit-in-place for section title (EN + ES), duration, and assignee name
- [ ] Add/remove subsections under Field Ministry
- [ ] Add/remove top-level sections
- [ ] All changes persist to localStorage immediately
- [ ] Section list respects mobile-first layout (no horizontal scroll at 360px)

## Acceptance Criteria

- [ ] First visit loads default S-38 sections; subsequent visits load saved config
- [ ] Editing a section title in English or Spanish saves correctly
- [ ] Changing a section duration updates immediately and persists
- [ ] Adding a name to a section saves and displays correctly
- [ ] Adding a subsection under Field Ministry creates a child row with default 5 min
- [ ] Removing a section removes it from the list and localStorage
- [ ] All text fields support Spanish input (accents, ñ, ¿, ¡)
- [ ] No horizontal scroll at 360px viewport width

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 1 | blocked-by | Uses layout, i18n, types, and storage from Phase 1 |
| 3 | blocks | Timer reads the section list from the same config |

## Notes

- The S-38 default is just a starting template; the user can modify everything.
- Subsections under Field Ministry are stored as children of the parent section in the data model.
- Duration units are minutes (integers). Display converts to MM:SS in the timer phase.
