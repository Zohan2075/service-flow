---
type: planning
entity: phase
plan: "responsive-and-zoom-lock"
phase: 3
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 3: Fixed-Positioning Containing Block Fix (save button root cause)

> Part of [responsive-and-zoom-lock](../plan.md)

## Objective

Eliminate the root cause behind the mobile Save/Update button issues: the page-transition wrapper in `(dashboard)/template.tsx` kept a CSS `transform` after its entrance animation (due to `animation-fill-mode: both` + a `translateY(0)` end keyframe), which made it the containing block for `position: fixed` descendants. Modals were positioned relative to that wrapper (inside `main` with `overflow-hidden`) instead of the viewport — clipping/misplacing them on real devices (browser UI, keyboard, OfflineBanner).

## Scope

### Includes

1. `web/tailwind.config.ts`:
   - `slide-up` / `scale-in` keyframes end at `transform: none` (no residual keyword animation value).
   - Removed `both` fill-mode from `scale-in` and `slide-up` animation tokens — the base style equals the final state, so no fill is needed and no transform residue remains after the animation.
2. React portals (`createPortal` → `document.body`) for all three fixed overlays:
   - `AddEntryModal.tsx`, `InterestedPersonModal.tsx`, `ConfirmDialog.tsx`
   - Guarded with `typeof document === "undefined"`; overlay classes/styles unchanged (visual-viewport vars still apply now that overlays are viewport-anchored).

### Excludes

- Behavior/state/handler changes; modal animations.

## Deliverables

- [x] Keyframes/animation tokens without persistent transform
- [x] Portaled modals (3 components)

## Acceptance Criteria

- [x] `getComputedStyle(templateWrapper).transform === "none"` after animation (live Chrome)
- [x] Modal overlays are direct `body` children (`offsetParent === null` → viewport-anchored)
- [x] Add Entry submit visible at 390×640 and with simulated keyboard (380px visual viewport)
- [x] Edit/Update Entry flow: modal opens from an existing entry and the Update button is visible
- [x] Entry submission works end-to-end
- [x] type-check + build green

## Evidence (2026-09-30, headless Chrome 390×640, production build)

```
TEMPLATE TRANSFORM AFTER ANIMATION: none
ADD MODAL:  overlayOffsetParent=none(viewport), bodyChild=true, submit 576–624, "Add Entry", visible
ENTRY SUBMITTED, MODAL CLOSED: true
EDIT BUTTON FOUND: true
EDIT MODAL: submit 576–624, "Update Entry", visible
SHRUNK VIEWPORT (keyboard): submitBottom=364 (≤ 380)
```

## Notes

- Chrome serializes a filled `to { transform: none }` transition as an identity matrix (`matrix(1,0,0,1,0,0)`), which still creates a containing block — hence removing the fill-mode entirely was required.
- Portals additionally protect the modals from any future transformed/filtered ancestor.
