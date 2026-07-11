---
type: planning
entity: plan
plan: "goals-ui-improvement"
status: completed
created: "2026-07-11"
updated: "2026-07-11"
---

# Plan: Goals UI Improvement

## Objective

Redesign the service goal cards in Settings → Reports & Goals to use an accordion layout with gradient-styled cards, reducing visual clutter and making the interface more compact and visually appealing.

## Motivation

The current service goal cards are vertically stacked with repetitive headers (icon + name + "Metas por Servicio" | Save/Clear buttons) for each service type. With 7+ service types, this creates a long, scrolling list that's hard to navigate. The user wants:
- A more compact, organized layout (accordion/tabs)
- Better visual hierarchy with gradient backgrounds using service type colors
- Refined typography and spacing

## Requirements

### Functional

- [x] Accordion layout: one expanded card at a time, others collapsed to show only service name + icon
- [x] Gradient card backgrounds using service type color (subtle, not overwhelming)
- [x] Refined current style: better spacing, typography, subtle shadows
- [x] Save/Clear buttons remain functional
- [x] Goal name input remains editable
- [x] Monthly/Annual metrics remain editable
- [x] Mobile responsive: accordion works well on small screens
- [x] Dark mode support maintained

### Non-Functional

- [x] No performance degradation (accordion state managed locally)
- [x] Accessible: keyboard navigation for accordion headers
- [x] Smooth expand/collapse animations

## Scope

### In Scope

- Rewrite `ServiceGoalCard` component to use accordion pattern
- Add gradient background styling using service type color
- Improve typography and spacing
- Add expand/collapse animation
- Update parent rendering to support accordion behavior (only one open at a time)

### Out of Scope

- Changes to goal data model or storage
- Changes to combined goals section (separate component)
- Changes to service types section (separate component)
- Changes to goal metrics calculation or validation

## Definition of Done

- [x] Accordion layout works: clicking a collapsed card expands it, others collapse
- [x] Gradient backgrounds use service type colors (subtle, readable in light/dark mode)
- [x] All existing functionality preserved (save, clear, edit name, edit metrics)
- [x] Mobile responsive: accordion usable on 375px+ screens
- [x] Dark mode: gradients and text remain readable
- [x] TypeScript compiles without errors
- [x] No console errors or warnings

## Testing Strategy

- Manual testing on desktop (Chrome) and mobile (iOS Safari, Android Chrome)
- Verify all goal editing functionality works after refactor
- Test accordion behavior: expand/collapse, only one open at a time
- Test dark mode rendering
- Test with long service names (truncation)

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Accordion + Gradient Cards | Rewrite ServiceGoalCard with accordion pattern and gradient styling | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Accordion state management complexity | Medium | Use simple React state in parent component to track which card is open |
| Gradient readability in dark mode | Low | Use subtle gradients with low opacity, ensure text contrast |
| Animation performance on mobile | Low | Use CSS transitions (transform/opacity), avoid layout thrashing |

## Changelog

### 2026-07-11

- Plan created
- Phase 1 completed: Accordion layout with gradient cards implemented
