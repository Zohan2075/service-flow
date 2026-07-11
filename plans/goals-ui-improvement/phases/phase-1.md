---
type: planning
entity: phase
plan: "goals-ui-improvement"
phase: 1
status: pending
created: "2026-07-11"
updated: "2026-07-11"
---

# Phase 1: Accordion + Gradient Cards

> Part of [goals-ui-improvement](../plan.md)

## Objective

Rewrite the `ServiceGoalCard` component to use an accordion pattern with gradient-styled cards, making the goals section more compact and visually appealing.

## Scope

### Includes

- Rewrite `ServiceGoalCard` component with accordion behavior (collapsed/expanded states)
- Add gradient background using service type color (subtle, low opacity)
- Improve typography: larger service name in header, better spacing
- Add expand/collapse animation (CSS transitions)
- Update parent component to track which card is expanded (only one at a time)
- Collapsed state: show service icon + name + subtle indicator (chevron)
- Expanded state: show full form (goal name, monthly/annual metrics, save/clear buttons)

### Excludes (deferred to later phases)

- Changes to combined goals section
- Changes to service types section
- Changes to goal data model or validation logic

## Prerequisites

- [ ] Current `ServiceGoalCard` component understood (lines 1595-1700 in settings/page.tsx)
- [ ] `GoalMetricFields` component understood (lines 1470-1590)
- [ ] Parent rendering logic understood (lines 953-970)

## Deliverables

- [ ] Refactored `ServiceGoalCard` component with accordion behavior
- [ ] Updated parent component with accordion state management
- [ ] Gradient background styling using service type color
- [ ] Expand/collapse animation
- [ ] Mobile responsive accordion

## Acceptance Criteria

- [ ] Clicking a collapsed card expands it, other cards collapse
- [ ] Gradient backgrounds use service type colors (subtle, readable)
- [ ] All existing functionality preserved (save, clear, edit name, edit metrics)
- [ ] Mobile responsive: accordion usable on 375px+ screens
- [ ] Dark mode: gradients and text remain readable
- [ ] TypeScript compiles without errors
- [ ] No console errors

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| (none) | - | Single phase plan |

## Notes

- Accordion state: Use `useState<string | null>` in parent to track expanded card ID
- Gradient: Use `linear-gradient(135deg, ${color}15, ${color}05)` for subtle effect
- Animation: Use `max-height` transition or CSS grid `grid-template-rows` for smooth expand
- Collapsed header: Show icon + name + chevron icon (rotate on expand)
- Keep Save/Clear buttons in expanded state only (not in collapsed header)
