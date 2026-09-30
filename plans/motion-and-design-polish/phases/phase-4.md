---
type: planning
entity: phase
plan: "motion-and-design-polish"
phase: 4
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 4: Verification

> Part of [motion-and-design-polish](../plan.md)

## Objective

Prove the whole plan end-to-end: static checks, production build, runtime smoke of all routes, code review of the diff, and fixes.

## Scope

### Includes

- `npm run type-check` and `npm run lint` in `web/` (note any pre-existing lint findings separately)
- `npm run build` in `web/`
- Dev-server smoke: `/login`, `/calendar`, `/reports`, `/presiding`, `/presiding/settings`, `/interested`, `/settings` return 200 and render
- Independent review of the full diff (delegate-strong, `review-implementation` focus):
  - correctness, behavior preservation (timers, drag-sort, swipe, cap checks)
  - reduced-motion handling, accessibility (focus rings, aria on Switch)
  - performance risks (stagger overuse, re-render regressions)
- Fix findings from review (route back through `implementer` for code fixes)
- Update plan/todo statuses

### Excludes

- New feature work
- User's manual visual QA (requested at the end, not blocking plan completion)

## Prerequisites

- [ ] Phases 1–3 complete

## Deliverables

- [ ] Command results recorded in todo.md changelog
- [ ] Review report (in chat or `plans/motion-and-design-polish/reviews/`)
- [ ] All high/medium findings resolved

## Acceptance Criteria

- [ ] type-check + build green
- [ ] No behavior regressions found in review
- [ ] All routes render in dev smoke
- [ ] Plan + todo updated to completed
