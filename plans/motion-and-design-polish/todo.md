---
type: planning
entity: todo
plan: "motion-and-design-polish"
updated: "2026-09-30"
---

# Todo: motion-and-design-polish

> Tracking [motion-and-design-polish](plan.md)

## Active Phase: — (all phases complete)

### Phase Context

- **Scope**: [Plan](plan.md) — completed
- **Implementation**: inline in phase docs
- **Latest Handover**: N/A
- **Relevant Docs**: [Review report](reviews/implementation-review.md)

### Pending

- [ ] (Manual) User visual QA: dark/custom surfaces, reduced-motion, 375px, animation feel

### In Progress

### Completed

- [x] Phase 1: Foundation <!-- completed: 2026-09-30 --> — motion@13.4.6, tokens, globals polish, motion presets, 4 primitives, MotionConfig; type-check + build green
- [x] Phase 2: Primary option surfaces <!-- completed: 2026-09-30 --> — AddEntryModal, calendar, interested (+modal), settings converted; `SegmentedControl` sm/md/lg sizes; build green; guardrails verified
- [x] Phase 3: Nav, transitions & remaining screens <!-- completed: 2026-09-30 --> — Sidebar/MobileNavBar indicators, `template.tsx` transitions, presiding/comments, reports/login/toaster
- [x] Phase 4: Verification <!-- completed: 2026-09-30 --> — independent review (no High); all actionable findings fixed; type-check + build + smoke green; lint errors only pre-existing
- [x] Phase 4 fixes: SSR-safe entrances (CSS `motion-safe:animate-slide-up`, hydration-aware StaggerGroup), dark-mode pill contrast, a11y labels, contrast-aware check glyphs, generic SegmentedControl, memoized variants

### Blocked

## Changelog

### 2026-09-30

- Plan created; Phase 1 started
- Phase 1 completed (build green); Phase 2 started
- Phase 2 completed (build green; swipe/dnd guardrails verified); Phase 3 started
- Phase 3 completed (build green); Phase 4 started
- Phase 4 completed: review + fixes; type-check, build, route smoke all green; lint = 8 pre-existing errors only
- Remaining: manual visual QA by user
