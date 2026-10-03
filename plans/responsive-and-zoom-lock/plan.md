---
type: planning
entity: plan
plan: "responsive-and-zoom-lock"
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Plan: Responsive Modals & Zoom Lock

## Objective

Fix small-viewport usability problems reported by the user:

1. The **Save/Add button in the time-entry modal is not visible on some devices** — pin modal actions so they are always reachable, regardless of screen height or keyboard state.
2. **Disable page zoom** on mobile and PC (best effort; browser menu zoom cannot be blocked).

## Motivation

- AddEntryModal (`max-h-[85dvh] overflow-y-auto`) and InterestedPersonModal (`max-h-[90dvh] overflow-y-auto`) scroll as a whole; the submit button sits at the end of long forms. On short screens or with the on-screen keyboard open, users cannot see/reach the save action.
- The app is a PWA used on phones; accidental pinch/trackpad zoom makes the layout feel broken. iOS also auto-zooms when focusing inputs with <16px font.

## Requirements

### Functional

- [ ] AddEntryModal: fixed header, independently scrolling field area, **pinned submit footer** (safe-area aware)
- [ ] InterestedPersonModal: same pinned-footer pattern; delete/confirm stays in the scroll area
- [ ] Zoom disabled via: viewport meta (`maximumScale`, `userScalable: false`), CSS `touch-action` on html/body, JS lock (Ctrl/Cmd + `+`/`-`/`0`, ctrl+wheel & trackpad pinch, Safari `gesture*` events)
- [ ] iOS focus auto-zoom prevented (mobile form controls forced to 16px)
- [ ] Leaflet map pinch-zoom preserved (map container has `touch-action: none` in leaflet.css)

### Non-Functional

- [ ] Handlers, state, i18n, reduced-motion behavior unchanged
- [ ] `npm run type-check` + `npm run build` green
- [ ] No layout regressions ≥320px

## Scope

### In Scope

- `web/src/components/entries/AddEntryModal.tsx` (footer restructure)
- `web/src/components/interested/InterestedPersonModal.tsx` (footer restructure)
- `web/src/app/layout.tsx` (viewport meta)
- `web/src/components/ZoomLock.tsx` (new)
- `web/src/components/Providers.tsx` (mount ZoomLock)
- `web/src/app/globals.css` (touch-action + iOS input font rule)

### Out of Scope

- Browser menu zoom (not interceptable)
- Modal enter/exit animations
- Other responsive redesigns (page layouts already use dvh/safe areas)

## Definition of Done

- [ ] Save/Add button visible without scrolling the modal shell on 320×568 and with keyboard open; fields scroll beneath it
- [ ] Pinch / Ctrl+wheel / Ctrl+`+`/`-`/`0` do not zoom the page; map pinch still works
- [ ] type-check + build + route smoke green
- [ ] Plan/todo updated

## Testing Strategy

- type-check + production build + route smoke (`next start`)
- Manual device/browser QA: iOS Safari + Android Chrome + desktop Chrome (Ctrl+wheel, Ctrl+±, trackpad pinch)
- Verify Leaflet map pinch-zoom still works in InterestedPersonModal

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Modal footers + zoom lock | Modal restructure, ZoomLock, viewport/CSS | completed |
| 2 | Visual viewport anchoring | Fix save button hidden by mobile browser UI/keyboard | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| iOS Safari ignores `user-scalable=no` in browser tabs (since iOS 10) | Medium | Safari `gesturestart/change` prevention + `touch-action` cover pinch; standalone PWA fully locked |
| `touch-action: pan-x pan-y` on body could affect Leaflet | Low | Map container sets `touch-action: none` (verified in leaflet.css) — more restrictive wins, JS pinch preserved |
| Non-passive wheel listener | Low | Handler only calls preventDefault when `ctrlKey`; standard lock pattern |
| 16px mobile inputs slightly change visual density | Low | Standard iOS anti-auto-zoom practice; improves readability |

## Changelog

### 2026-09-30

- Plan created from user report (save button visibility + zoom lock request).
- Phase 1 completed: AddEntryModal + InterestedPersonModal now use fixed header / scrollable fields / pinned safe-area footer; zoom lock added (viewport `maximumScale`/`userScalable`, `ZoomLock` component for Ctrl/Cmd+`+`/`-`/`0`, ctrl+wheel & Safari gestures, `touch-action: pan-x pan-y`, mobile 16px inputs); Leaflet map pinch preserved. type-check + build + route smoke green.
- Phase 2 completed (user-reported regression: save button still hidden on device): root cause = `fixed inset-0` overlays anchor to the layout viewport, so mobile browser UI / iOS keyboard cover the pinned footer. Fix: `ViewportSync` mirrors `visualViewport` into `--app-vv-height`/`--app-vv-top`; both modal overlays size from those vars; safe-area padding calc fixed (was invalid CSS, now `calc(env(safe-area-inset-bottom) + 1rem)`); `interactiveWidget: "resizes-content"` added. Live puppeteer verification: submit visible at 640px and when the visual viewport shrinks to 380px (keyboard simulation). Build + route smoke green.
