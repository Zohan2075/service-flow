---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 3
status: completed
created: "2026-10-17"
updated: "2026-10-17"
---

# Phase 3: Global Floating Mini-Clock (Resizable)

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

A compact floating pill, visible on every dashboard page, that shows the active clock and allows pause/expand/resize while navigating the app.

## Scope

### Includes

**A. NEW `web/src/components/TimeWidget.tsx`** (client component, portaled or rendered fixed):

- **Mount**: `web/src/app/(dashboard)/layout.tsx` (after `<MobileNavBar />`), so it appears on all dashboard pages.
- **Visibility**: renders when `timeTools.widgetVisible`; auto-set true on stopwatch/countdown start (Phase 2). X button hides (`setWidgetVisible(false)`).
- **Content priority (focus clock)**: countdown (if `totalMs > 0`) → stopwatch (if any value/running) → country clock (if `countryTz`) → local clock. Shows a small icon + `font-mono tabular-nums` time.
- **Controls**:
  - Pause/resume button — acts on the focus clock when it is stopwatch/countdown (hidden for clocks).
  - Main time → `router.push("/presiding?tab=time")`.
  - X (hidden while nothing is active is acceptable) to dismiss.
- **Resize**: bottom/right drag handle (grip icon); pointer-drag adjusts scale 0.8–1.6 (clamped), persisted via `setWidgetScale` (write on release); double-tap handle resets to 1. The pill scales via `transform: scale()` with transform-origin bottom-right; hit area and position must not overlap the mobile nav (`bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]` on mobile; `md:bottom-4 md:right-4`).
- **Global countdown alert**: the widget owns a 1s tick while countdown is running (and while widget is mounted); on reaching 0 → beep + `toast` (reuse Phase 2 logic helper if extracted; otherwise duplicate minimal logic) and mark `finishedAtMs`.
- **Offline safe**: pure client; no network.

**B. i18n additions if missing**: `time.widget`, `time.showWidget`, `time.hideWidget`, `time.resize` (EN/ES).

## Hard Guardrails

- Must not intercept pointer events outside the pill; z-index below modals (modals are z-[60]/[80] — use ~z-40) but above page content.
- No layout regressions: fixed positioning only; never inside scroll containers.
- No changes to program timers.

## Deliverables

- [ ] `TimeWidget` with focus logic, controls, resize handle
- [ ] Mounted in dashboard layout
- [ ] Global countdown completion alert

## Acceptance Criteria

- [ ] Start stopwatch in Tiempo → navigate to Calendario → pill visible and ticking; pause from pill works; tap opens `/presiding?tab=time`
- [ ] Drag-resize changes scale, persists across reloads; clamped 0.8–1.6
- [ ] Countdown started in Tiempo alerts while on another page
- [ ] type-check passes; no overlap with mobile nav/FABs

## Notes

- Keep the pill compact by default (scale 1 ≈ current FAB proportions).

## Completion Evidence (2026-10-17)

- Implemented: `TimeWidget.tsx` (focus priority, pause/resume, tap→Time tab, hide, drag-grip resize with live %, persist-on-release, global countdown alert owner), mounted in `(dashboard)/layout.tsx`; `useCountdownCompletion` removed from TimeView + page; i18n `time.widget/hide/resize` EN/ES.
- **Bug found during verification and fixed**: `stopwatchStart`/`countdownStart` set `widgetVisible: true` at the store root instead of inside `timeTools` (widget never rendered). Fixed to `timeTools.widgetVisible`.
- Live verification (headless Chrome, 390×720):
  - Widget visible on `/calendar` while a stopwatch runs; `timer 00:00:02` shown
  - Pause from pill → frozen (`00:00:02`, icon flips to resume)
  - Tap time → `/presiding?tab=time`
  - Grip drag +60px → `scale(1.5)`; **new page (same IndexedDB)** → scale(1.5) + stopwatch value persisted
  - X → widget hidden; display/viewport pristine (no wrappers; fixed positioning)
  - Countdown completion alert fired on `/calendar` ("Time's up!") — global owner works
- Positioning: mobile `right-20` clears the calendar/interested FAB (`right-4`); desktop `md:right-4 md:bottom-4`; growth via `transform-origin: bottom right` (up-left).
- `type-check` + `build` green.
