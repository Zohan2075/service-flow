---
type: planning
entity: phase
plan: "responsive-and-zoom-lock"
phase: 1
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 1: Modal Footers + Zoom Lock

> Part of [responsive-and-zoom-lock](../plan.md)

## Objective

Make modal primary actions always visible (pinned footers) and lock page zoom across mobile/desktop while preserving Leaflet map pinch-zoom.

## Scope

### Includes

**A. AddEntryModal** (`web/src/components/entries/AddEntryModal.tsx`)

Restructure panel (currently `max-h-[85dvh] overflow-y-auto` with sticky header and submit at the form end):

- Panel: `… w-full max-w-lg md:mx-4 shadow-2xl max-h-[92dvh] md:max-h-[85dvh] flex flex-col overflow-hidden` (drop `overflow-y-auto`).
- Header: drop `sticky top-0 z-10`, add `shrink-0` (keep padding/border/bg).
- Form: `className="flex flex-col flex-1 min-h-0"`.
- Wrap all fields in a scroll region: `div className="p-4 md:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0"`.
- Footer (still inside `<form>`): `div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-surface p-4 md:p-6 pt-3 md:pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-6"` containing the existing `motion.button` submit unchanged.
- All handlers/state/fields byte-identical.

**B. InterestedPersonModal** (`web/src/components/interested/InterestedPersonModal.tsx`)

Same pattern for panel (`max-h-[90dvh] overflow-y-auto`):

- Panel: `max-h-[92dvh] md:max-h-[90dvh] flex flex-col overflow-hidden`.
- Header → `shrink-0` (drop sticky).
- Form → `flex flex-col flex-1 min-h-0`; fields + delete/confirm section stay in the scroll region (`overflow-y-auto overscroll-contain flex-1 min-h-0`).
- Footer (inside form): pinned Save button (existing markup/classes) with safe-area padding.
- Delete/reactivate flow unchanged.

**C. Zoom lock**

1. `web/src/app/layout.tsx` viewport: add `maximumScale: 1, userScalable: false` (keep existing width/initialScale/viewportFit/themeColor).
2. NEW `web/src/components/ZoomLock.tsx` (`"use client"`, renders null):
   - `keydown`: preventDefault when (Ctrl or Cmd) and key in `["+","-","=","_","0"]`
   - `wheel` (window, `{ passive: false }`): preventDefault when `event.ctrlKey`
   - `gesturestart`/`gesturechange`/`gestureend` (document): preventDefault unless `event.target.closest(".leaflet-container")`
   - Cleanup all listeners; declare `DocumentEventMap` augmentation for gesture events (not in lib.dom).
3. `web/src/components/Providers.tsx`: mount `<ZoomLock />` next to `<SyncGuard />`.
4. `web/src/app/globals.css`:
   - `html, body { touch-action: pan-x pan-y; }`
   - `@media (max-width: 767px) { input:not([type="checkbox"]):not([type="radio"]), select, textarea { font-size: 16px !important; } }`

## Excludes

- Modal animations, other layout redesigns, page-level scroll behavior changes.

## Prerequisites

- [ ] AddEntryModal/InterestedPersonModal read (current structure verified 2026-09-30)
- [ ] leaflet.css verified: interactive map container uses `touch-action: none`/`pinch-zoom` (map pinch preserved)

## Deliverables

- [ ] AddEntryModal pinned footer
- [ ] InterestedPersonModal pinned footer
- [ ] `ZoomLock.tsx` + provider mount
- [ ] Viewport meta + globals.css rules

## Acceptance Criteria

- [ ] Submit visible at 320×568 and with keyboard open; fields scroll independently; Enter still submits
- [ ] Pinch and Ctrl/Cmd zoom blocked; Leaflet map pinch-zoom works
- [ ] No handler/state/i18n changes
- [ ] `npm run type-check` passes

## Notes

- Use `dvh` caps (mobile gains height vs old 85/90dvh).
- Safe-area footer padding: `pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-6`.
