---
type: planning
entity: phase
plan: "motion-and-design-polish"
phase: 1
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 1: Foundation

> Part of [motion-and-design-polish](../plan.md)

## Objective

Install the Motion library and establish the shared motion + design-token foundation: motion presets, animated UI primitives (`SegmentedControl`, `OptionChip`, `Switch`, `PressableCard`, stagger helpers), refreshed design tokens and global styles. No application surfaces are converted in this phase.

## Scope

### Includes

1. **Dependency**: `motion` (v12+, React 19 compatible) added to `web/package.json` (`npm install motion` in `web/`).
2. **Tokens** — `web/tailwind.config.ts`:
   - `boxShadow`: `card` (soft ambient), `card-hover` (lifted), `popover`
   - `transitionTimingFunction`: `spring-out: cubic-bezier(0.22, 1, 0.36, 1)`
   - `keyframes`/`animation`: `fade-in`, `scale-in`, `slide-up` (CSS fallbacks for non-motion contexts)
3. **Globals** — `web/src/app/globals.css`:
   - Global `:focus-visible` ring using `rgb(var(--sf-primary))` (2px ring + offset, consistent across buttons/inputs/links)
   - `::selection` primary tint
   - Thin, theme-aware scrollbars
   - `-webkit-tap-highlight-color: transparent`
   - `body { transition: background-color 300ms ease, color 300ms ease; }` for smoother theme/accent swaps
4. **Motion presets + helpers** — `web/src/components/ui/motion.tsx`:
   - `SPRING_SOFT` (stiffness 400, damping 32), `SPRING_SNAPPY` (stiffness 500, damping 35), `EASE_OUT = [0.22, 1, 0.36, 1]`
   - Variants: `fadeUp`, `popIn`, `staggerContainer(step = 0.04)`
   - `StaggerGroup` (motion.div, container variants) and `StaggerItem` (motion.div, item variants) components
5. **Primitives** in `web/src/components/ui/`:
   - `SegmentedControl.tsx` — sliding pill via `layoutId` + spring; props `options`, `value`, `onChange`, `size`, `className`, `fullWidth`; container matches current pattern `bg-slate-100 dark:bg-slate-800 p-1 rounded-xl`; pill `bg-surface shadow-sm`; selected label `text-primary`; unique `layoutId` via `useId`
   - `OptionChip.tsx` — `motion.button` with `whileTap`/`whileHover`; props `selected`, `onClick`, `variant: "solid" | "soft"`, `color`, `icon`, `className`; solid = selected bg uses `color` + white text (service types); soft = selected `border-primary bg-primary/10 text-primary` (filter chips)
   - `Switch.tsx` — springy knob (`SPRING_SNAPPY`), track `h-6 w-11 rounded-full` with `transition-colors`, knob `size-5`, optional `checkedClassName` (e.g. `bg-amber-500`), `disabled`, `aria-checked`
   - `PressableCard.tsx` — motion wrapper with hover lift (`y: -2`) + tap compress (`scale: 0.99`), className passthrough
6. **MotionConfig** — wrap the provider tree in `Providers.tsx` with `<MotionConfig reducedMotion="user" transition={SPRING_SOFT}>`.

### Excludes (deferred)

- Converting any page/component to use the primitives (Phase 2/3)
- Modal enter/exit animations (out of scope for whole plan)

## Prerequisites

- [ ] `web/package.json` currently has no animation library
- [ ] `web/tailwind.config.ts` `plugins: []`, custom colors via CSS vars
- [ ] `web/src/app/globals.css` holds the only global stylesheet

## Deliverables

- [ ] `motion` dependency installed
- [ ] Updated `tailwind.config.ts` + `globals.css`
- [ ] `web/src/components/ui/motion.tsx` (presets + stagger helpers)
- [ ] `web/src/components/ui/SegmentedControl.tsx`
- [ ] `web/src/components/ui/OptionChip.tsx`
- [ ] `web/src/components/ui/Switch.tsx`
- [ ] `web/src/components/ui/PressableCard.tsx`
- [ ] `Providers.tsx` wrapped in `MotionConfig`

## Acceptance Criteria

- [ ] `npm run type-check` passes in `web/`
- [ ] `npm run build` passes in `web/`
- [ ] Primitives compile and render (no usage yet)
- [ ] No changes to app behavior (purely additive)
- [ ] Reduced motion respected via `MotionConfig reducedMotion="user"`

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|--------------|-------|
| 2, 3 | Blocks | All conversions import these primitives |

## Notes

- Use `import { motion } from "motion/react"` (v12 API).
- Keep all values Tailwind-friendly; avoid magic numbers outside the primitives.
- Do not add `tailwindcss-animate`; Motion handles enter/exit where needed.
