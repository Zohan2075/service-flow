---
type: planning
entity: phase
plan: "motion-and-design-polish"
phase: 3
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 3: Nav, Transitions & Remaining Screens

> Part of [motion-and-design-polish](../plan.md)

## Objective

Complete motion coverage: animated navigation, page transitions, presiding/comments/reports/login surfaces, and toaster restyle.

## Scope

### Includes

**A. Navigation & layout**

- `web/src/components/layout/Sidebar.tsx`: active nav indicator via shared `layoutId` (`sidebar-active`) behind the active link; icon `whileHover` micro-scale; theme toggle (lines ~76–91) → compact `SegmentedControl`; sign-out button press feedback
- `web/src/components/layout/MobileNavBar.tsx`: active tab spring indicator (unique `layoutId`), press feedback on tabs + logout
- **New** `web/src/app/(dashboard)/template.tsx`: client component, `motion.div` fade + 8px slide-up (`EASE_OUT`, ~0.25s) wrapping `children` → page transitions on route change

**B. Presiding & Comments**

- `web/src/app/(dashboard)/presiding/page.tsx`: Program/Comments tab bar (lines ~115–142) → `SegmentedControl` (or sliding underline with `layoutId`)
- `web/src/components/presiding/ProgramView.tsx`:
  - Week selector popover (lines ~572–599): animate-in (`popIn`, scale 0.98→1 + fade) — keep click-outside behavior
  - TimerButton (lines ~823–848): press spring, running-state feedback (keep existing pulse logic)
  - Inline-edit field tabs (lines ~905–913) → compact `SegmentedControl`
- `web/src/components/comments/CommentsView.tsx`: `BoxCard` entrance stagger + hover lift; keep dnd-kit transform wrappers untouched; keep `animate-ping`/`animate-pulse` timer indicators

**C. Reports, login, toaster**

- `web/src/app/(dashboard)/reports/page.tsx`: summary/goal cards `StaggerGroup` entrance; progress fills (~698, ~946, ~1158) → spring-animated width; month nav press feedback
- `web/src/app/login/page.tsx`: card `fadeUp` entrance; Google button press/hover polish
- `web/src/components/Providers.tsx`: restyle `react-hot-toast` `toastOptions` to match surfaces (`rounded-xl`, border, `shadow-card`, dark-aware) — keep default enter/exit animations

### Excludes

- Modal enter/exit animations (out of scope)
- Any changes to `mobile/` or `Presidents/`

## Prerequisites

- [ ] Phase 1 complete
- [ ] Phase 2 does not touch these files (disjoint)

## Deliverables

- [ ] Sidebar + MobileNavBar animated
- [ ] `(dashboard)/template.tsx` page transitions
- [ ] Presiding, ProgramView, CommentsView converted
- [ ] Reports, login polished
- [ ] Toaster restyled

## Acceptance Criteria

- [ ] Nav active states correct on all 5 routes (desktop + mobile)
- [ ] Route transitions smooth, no flash/layout jump
- [ ] Timers, drag-sort, popover interactions unchanged functionally
- [ ] `npm run type-check` passes

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|--------------|-------|
| 1 | Depends on | Primitives + presets |
| 2 | Independent | Disjoint files |

## Notes

- `template.tsx` must be `"use client"` and should not remount providers.
- Toaster styling must respect user-customized surfaces (uses `bg-surface` semantics where possible).
