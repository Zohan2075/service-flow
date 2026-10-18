---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 1
status: completed
created: "2026-10-17"
updated: "2026-10-17"
---

# Phase 1: Program Typography + Timer Circles

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Improve readability of the Program dashboard: larger, better-hierarchied typography with tabular numerals on all times, and slightly bigger part-timer circles + fonts. Typography/structure-neutral (only size/weight/font-feature classes).

## Scope

### Includes

**A. TimerButton** (`ProgramView.tsx` ~831–862):
- Main circle: `size-12 sm:size-14` → `size-14 sm:size-16`.
- Play/stop icon: `text-xs sm:text-sm` → `text-sm sm:text-base`.
- Time text: `text-[10px] sm:text-[11px]` → `text-[11px] sm:text-xs`; keep `tabular-nums` & `font-mono`.
- Reset button: `size-11` → `size-12`; icon `text-base` → `text-lg`.

**B. ActiveTimerBar** (`ProgramView.tsx` ~338+): bump time display, title, and labels by +1 Tailwind step; keep `tabular-nums`.

**C. TimerLegend** (~864–873): `text-[10px]` → `text-xs`.

**D. ProgramView general type scale** (apply judiciously through the file):
- All time displays (start/end/duration, meeting clock, totals): ensure `tabular-nums` + at least `text-xs`; bump `text-[10px]` → `text-xs`.
- Intervention titles: `text-sm` → `text-base` where truncation/layout allows.
- Section headers / day heading: +1 step.
- Small status labels (`text-[10px]`): → `text-xs`.
- **Cap: maximum +1 step per element; no element type/structure/layout changes; no class changes other than font-size/weight/tabular-nums (and removing `text-[10px]`).**

### Excludes

- Store/timer logic, sections structure, dialog/popover behavior.

## Prerequisites

- [ ] Read the current typography of ProgramView regions listed above

## Deliverables

- [ ] Bigger timer circles with +1 step fonts
- [ ] Type-scale bumps (cap +1 step) with tabular numerals throughout

## Acceptance Criteria

- [ ] No layout breaks at 375px and desktop (verified with screenshots)
- [ ] Times use `tabular-nums`; hierarchy improved (titles/section headers clearer)
- [ ] `npm run type-check` passes

## Notes

- Judge each bump: if a bump would wrap/overflow (tight rows), skip that element (note it in the digest).

## Completion Evidence (2026-10-17)

- Executed 24 class-only edits (digest: no structure/logic changes; 9/9 `text-[10px]` bumped; planned skips honored).
- Live checks: mobile 375px — heading 20px, timer circle 56px, timer font 11px, `main` scrollWidth == clientWidth (no overflow); desktop 1280px — heading 24px, circle 64px, font 12px, no overflow.
- Screenshots: `presiding-375.png`, `presiding-desktop.png` — circles visibly larger; layout intact.
- `type-check` + `build` green.
