---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 5
status: completed
created: "2026-10-18"
updated: "2026-10-18"
---

# Phase 5: Fullscreen Display Mode + Timer Mutual Exclusion

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Two user requests:

1. **Fullscreen mode**: a big display for the clock + timers (stopwatch / countdown) with large controls, launched from the Time tab. **Landscape**: on open, attempt to lock the device orientation to landscape (`screen.orientation.lock` — works on Android fullscreen; not available on iPhone → the UI still works in portrait). Extras: screen Wake Lock, controls auto-hide while a timer runs (tap to show), high-contrast dark styling.
2. **Timer mutual exclusion**: the **stopwatch and the countdown cannot run at the same time** — starting one while the other is running must be blocked (store-enforced + UI feedback). Clocks are unaffected.

## Scope

### Includes

**A. Store guards** — `web/src/lib/store.ts`:
- `stopwatchStart`: no-op when `countdown.running` (in addition to the existing `stopwatch.running` no-op).
- `countdownStart`: no-op when `stopwatch.running`.

**B. TimeView** — `web/src/components/presiding/TimeView.tsx`:
- Extend the existing start-blocking: the stopwatch start/resume is disabled while `countdown.running`; the countdown start/resume is disabled while `stopwatch.running` (pause actions stay enabled). Show a small amber hint in the affected card when blocked by the other timer (new key `time.timerBusy`), reusing the existing hint styling.
- Add a **"Pantalla completa"** launch button at the top of the scroll area (icon `fullscreen`). The onClick MUST call `document.documentElement.requestFullscreen()` (if available) synchronously (user gesture), then set the overlay state. (iPhone Safari has no element fullscreen → skip gracefully; the overlay alone acts as pseudo-fullscreen.)

**C. NEW `web/src/components/presiding/FullscreenClock.tsx`** — `onClose` prop:
- Rendered as `fixed inset-0 z-[70] bg-slate-950 text-white` (above modals z-[60], below toasts).
- On mount: attempt `screen.orientation.lock("landscape")` (try/catch; unlock on unmount), acquire a screen **Wake Lock** (`navigator.wakeLock.request("screen")`, re-acquire on `visibilitychange`; release on unmount; typed via a local interface cast — do not use `any`), and listen to `fullscreenchange` → if `document.fullscreenElement` becomes null, close.
- Content: giant `font-mono tabular-nums` time centered. Internal mode state `"clock" | "stopwatch" | "countdown"`, initialized from the current focus (stopwatch running → stopwatch; countdown running → countdown; else clock). Tapping the big time cycles modes.
  - clock: live time (country tz if set, else device) + date line; no controls. Respect `presidingPrefs.timeFormat`.
  - stopwatch: `HH:MM:SS` + large Start/Pause + Reset (respect the mutual exclusion: Start disabled while countdown runs).
  - countdown: remaining time + Start/Pause + Reset; if idle with `totalMs == 0` show quick-start chips (5 / 10 / 15 min) instead of Start.
- Controls: large buttons (min 56–64px), row at the bottom; **auto-hide** after ~4 s while a timer runs (any tap re-shows and restarts the timer); visible X (top-right, `t("time.exitFullscreen")`) always exits (exitFullscreen + close); Escape key exits.
- Exit path: `onClose()` + `document.exitFullscreen().catch()` when active.

**D. i18n** — `web/src/lib/i18n.tsx` (EN + ES): `time.fullscreen` ("Full screen" / "Pantalla completa"), `time.exitFullscreen` ("Exit" / "Salir"), `time.tapToCycle` ("Tap the time to switch clock" / "Toca la hora para cambiar de reloj"), `time.timerBusy` ("Another timer is running — stop it first" / "Otro temporizador está en marcha — deténlo primero").

### Excludes

- Rotating the content 90° in portrait (user chose orientation-lock only).
- Changes to the floating widget or program part timers.

## Deliverables

- [ ] Store mutual-exclusion guards
- [ ] TimeView blocking + hints + fullscreen launch button
- [ ] `FullscreenClock` (modes, controls, wake lock, orientation lock, auto-hide)
- [ ] i18n keys EN/ES

## Acceptance Criteria

- [ ] Cannot start the stopwatch while the countdown runs (and vice versa) — from the Time tab, the widget, or fullscreen; blocked controls show the hint
- [ ] Fullscreen opens landscape on Android (orientation lock attempted); works in portrait elsewhere; X / Escape / system-exit all close it
- [ ] Screen stays awake while fullscreen (where the API is available)
- [ ] `npm run type-check` + `npm run build` green; live puppeteer verification

## Notes

- The user's existing `floatedKind` mutual-exclusion (floating-pill based) stays untouched — this phase adds the RUNNING-based rule on top.
- Wake Lock / orientation APIs must be optional-chained and wrapped in try/catch (iOS support gaps).

## Completion Evidence (2026-10-18)

- Implemented: store guards (stopwatchStart↔countdownStart mutual exclusion); TimeView busy flags + amber `time.timerBusy` hints + fullscreen launcher; NEW `FullscreenClock.tsx` (modes clock/stopwatch/countdown with tap-to-cycle, giant controls, quick-start chips, wake lock, `orientation.lock("landscape")` attempt, auto-hide ~4s with tap-to-reveal, Escape/X/fullscreenchange close, single exit owner); 4 i18n keys ×EN/ES.
- UX fix during verification: while the controls are hidden, a tap on the big time now only reveals them (never switches mode).
- Live verification (headless Chrome, real fullscreen `document.fullscreenElement: true`):
  - Mutual exclusion both directions with disabled buttons + amber hints; blocked click leaves the timer at 00:00:00
  - Fullscreen: controls present → auto-hidden after ~5 s → real tap re-shows them → time tap (controls visible) cycles mode (countdown shows 5/10/15-min chips at 0) → X closes
- `type-check` + `build` green.
- Note (test methodology): control buttons carry visible text (Pause/Reset), not aria-labels — probes must be text-aware.
