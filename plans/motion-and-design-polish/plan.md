---
type: planning
entity: plan
plan: "motion-and-design-polish"
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Plan: Motion & Design Polish

## Objective

Add modern, spring-based motion to every "option" interaction across the ServiceFlow web app and apply a systematic visual polish pass, using the Motion (framer-motion) library plus shared UI primitives and refreshed design tokens.

## Motivation

The app currently has no animation framework: option controls (segmented toggles, chips, switches, tabs, presets) give minimal or instant feedback, and interactive states are hand-rolled per page. A consistent motion + token system makes the app feel modern, responsive, and polished while reducing duplicated styling code.

## Requirements

### Functional

- [ ] Motion library installed (`motion`, React 19 compatible) configured with reduced-motion support
- [ ] Shared primitives: `SegmentedControl`, `OptionChip`, `Switch`, `PressableCard`, stagger helpers, motion presets
- [ ] Option presses animated: service-type chips, accent/surface/background presets, filter chips, theme choices
- [ ] Segmented controls & tabs use sliding spring indicator
- [ ] Toggles/switches use springy knob animation
- [ ] Nav (sidebar + mobile) active indicators animate; page transitions fade/slide
- [ ] Lists/cards: staggered entrance + hover lift
- [ ] Design tokens: shadow scale, focus-visible rings, selection color, scrollbars, press feedback

### Non-Functional

- [ ] `prefers-reduced-motion` respected (`MotionConfig reducedMotion="user"`)
- [ ] No layout regression on 375px+ or desktop; dark mode + custom accent themes preserved
- [ ] i18n untouched; dnd-kit sortable behavior untouched; calendar swipe intact
- [ ] `type-check` + production build pass

## Scope

### In Scope

- `web/` only (Next.js 15 + Tailwind 3 app)
- Shared UI primitives + token refresh + motion presets
- Application across: AddEntryModal, calendar, interested (+modal), settings, presiding (+ProgramView), comments, reports, login, Sidebar, MobileNavBar, toaster
- Page transition via `(dashboard)/template.tsx`

### Out of Scope

- Modal/dialog enter-exit animations (AddEntryModal, InterestedPersonModal, ConfirmDialog stay instant) — user decision 2026-09-30
- Bold redesign (no font/layout/IA changes)
- `mobile/` (Flutter) and `Presidents/` prototype
- New features or behavior changes

## Definition of Done

- [ ] All phase acceptance criteria met
- [ ] `npm run type-check` clean
- [ ] `npm run build` passes
- [ ] Manual visual check: light/dark/custom accent, reduced motion, mobile width
- [ ] Plans/todo updated

## Testing Strategy

- `npm run type-check`, `npm run lint`, `npm run build` in `web/`
- Dev-server smoke check of all routes
- Manual animation review (user) on key screens

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Foundation | deps, tokens, globals.css, presets, primitives, MotionConfig | completed |
| 2 | Primary option surfaces | AddEntryModal, calendar, interested, settings | completed |
| 3 | Nav, transitions & remaining screens | Sidebar, MobileNavBar, template, presiding, comments, reports, login, toaster | completed |
| 4 | Verification | lint/type-check/build, review, fixes | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Motion adds ~30–35kb gzip | Low (PWA cached) | Accept for feature quality; imports tree-shaken |
| `template.tsx` remounts per route | Low | Standard Next pattern; pages are route-distinct |
| Animated stagger jank on long lists | Medium | Cap stagger steps ≤0.05s; animate entries/cards only, never the 42-cell calendar grid |
| dnd-kit transform conflict with motion wrappers | Medium | Never wrap sortable transform wrappers in motion; animate inner controls only |
| Subagent style drift | Medium | Precise specs in phase docs; spot review after each phase |

## Changelog

### 2026-09-30

- Plan created. User decisions: Motion library, systematic refresh, animation areas = options/segments/toggles/nav/lists; modals excluded.
- Phase 1 completed: `motion@13.4.6`; design tokens (shadows, easing, keyframes) + globals polish; motion presets + `StaggerGroup`/`StaggerItem`; primitives `SegmentedControl`/`OptionChip`/`Switch`/`PressableCard`; `MotionConfig reducedMotion="user"`; type-check + build green.
- Phase 2 started (3 parallel workstreams: AddEntryModal+calendar, interested+modal, settings).
- Phase 2 completed: option surfaces converted (chips, segmented controls, switches, preset swatches, card/list stagger + hover lift). `SegmentedControl` gained `sm/md/lg` sizes with min-height touch targets. Phase-level `npm run build` green; swipe-carousel and dnd-kit guardrails verified untouched (zero refs in diff).
- Phase 3 started (3 parallel workstreams: Sidebar+MobileNavBar+template, presiding/comments, reports/login/toaster).
- Phase 3 completed: nav active indicators, page transitions, presiding/comments, reports/login/toaster; phase build green.
- Phase 4 completed: independent review ([report](reviews/implementation-review.md)) — no High findings; 2 Medium + 6 Low fixed (SSR-safe entrances, dark-mode pill contrast, a11y labels, contrast-aware check glyphs, generic SegmentedControl, hydration-aware staggers). type-check + build + route smoke green; lint: only 8 pre-existing errors (zero introduced).
