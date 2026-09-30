---
type: planning
entity: phase
plan: "motion-and-design-polish"
phase: 2
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 2: Primary Option Surfaces

> Part of [motion-and-design-polish](../plan.md)

## Objective

Convert the app's primary "press an option" surfaces to the Phase 1 primitives: AddEntryModal, calendar, interested (+modal), and settings. This is where the user-visible motion payoff lands.

## Scope

### Includes

**A. AddEntryModal** (`web/src/components/entries/AddEntryModal.tsx`)

- Service-type chips (line ~313) → `OptionChip` `variant="solid"` with `color={st.color}` + icon
- Duration/Start-End toggle (line ~392) → `SegmentedControl` fullWidth
- Plan mode toggle (line ~369) → `Switch` with `checkedClassName="bg-amber-500"`
- Submit button: `whileTap` compress via motion

**B. Calendar** (`web/src/app/(dashboard)/calendar/page.tsx`)

- Monthly/Weekly view toggle (line ~621) → `SegmentedControl`
- Month nav + Today buttons: press feedback (`whileTap`)
- Monthly cap progress fill (line ~732): spring-animated width (`motion.div` animate width, keep rounded/transition fallback)
- Mobile FAB (line ~897): hover scale 1.05 / tap 0.9
- Entry cards / mobile day lists (EntryCard line ~929): subtle `StaggerGroup`/`StaggerItem` entrance (step 0.03) + hover lift via `PressableCard` semantics — do **not** animate the 42-cell month grid itself and do **not** touch the swipe carousel logic (`SWIPE_ANIM_MS`, touch handlers)

**C. Interested** (`web/src/app/(dashboard)/interested/page.tsx`)

- Active/Finished tabs (line ~142) → `SegmentedControl`
- Status filter chips (line ~175) → `OptionChip` `variant="soft"` (keep status color dots inside children)
- Person cards (lines ~230–390): entrance stagger + hover lift; completed toggle gets a scale-pop on the check icon
- FAB: hover/tap feedback

**D. InterestedPersonModal** (`web/src/components/interested/InterestedPersonModal.tsx`)

- Gender segmented options (line ~320) → `SegmentedControl`
- Status chips (line ~355) → `OptionChip`
- Keep existing chevron rotation behavior

**E. Settings** (`web/src/app/(dashboard)/settings/page.tsx`)

- Category grid (lines ~518–531): `StaggerGroup` + `PressableCard` hover lift, icon micro-motion
- Theme buttons (lines ~684–697) → `SegmentedControl`
- Accent presets (lines ~705–715): press animation + animated selected ring/check (scale-in)
- Surface/background presets (lines ~748–792+): same treatment
- All hand-rolled toggles → `Switch` (plan mode ~939, showYearTotals ~1050, monthly cap ~1071, notifications, etc.)
- Segmented rows → `SegmentedControl` (duration/range ~957, week-start ~1012, service-type time/units ~2365, status items)
- **dnd-kit guard**: `SortableServiceTypeItem` / `SortableStatusItem` — only replace inner controls; never wrap or restyle the transform/sort wrapper

### Excludes

- Sidebar/MobileNavBar, page transitions, presiding, comments, reports, login, toaster (Phase 3)
- Modal enter/exit animations (out of scope)

## Prerequisites

- [ ] Phase 1 complete: all primitives available and building

## Deliverables

- [ ] AddEntryModal converted
- [ ] Calendar option controls + entry lists converted
- [ ] Interested page + modal converted
- [ ] Settings option surfaces converted

## Acceptance Criteria

- [ ] Every converted control retains identical behavior (state updates, toasts, cap checks)
- [ ] No layout shift vs. previous rendering at 375px and desktop
- [ ] Dark mode + custom accent/surface/background themes look correct
- [ ] `npm run type-check` passes
- [ ] Calendar swipe, dnd-kit sorting still work

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|--------------|-------|
| 1 | Depends on | Primitives + tokens |
| 3 | Independent | Disjoint files |

## Notes

- Keep edits surgical in large files (`settings/page.tsx` 2771 lines, `calendar/page.tsx` ~50KB).
- Do not touch i18n keys or store logic.
