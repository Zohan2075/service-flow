---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 6
status: completed
created: "2026-10-19"
updated: "2026-10-19"
---

# Phase 6: Pill Close-Stop, Paused Focus, Dedicated Fullscreens

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Four user-requested behavior changes:

1. **Pill X = close + pause**: pressing the floating widget's X closes it AND **pauses** the running stopwatch/countdown that is being shown (time kept; resumable later with ▶).
2. **Paused timers keep the pill**: when either timer is paused (with a value), the pill keeps showing that frozen time (with the ▶ resume button) — restoring paused-in-focus before the clocks.
3. **Clock mode has no timer buttons**: when the pill shows the real time (clock focus), it must NOT show the pause/play timer button (only time + grip + X).
4. **No native fullscreen API + dedicated per-option fullscreens**:
   - Stop using `documentElement.requestFullscreen()` entirely (the browser's "You're in fullscreen..." notice disappears; side effect accepted: Android orientation-lock no longer applies — keep the best-effort attempt, it silently no-ops).
   - **Each card** (Stopwatch, Countdown, Local clock, Country clock) gets its own small fullscreen button; the fullscreen opens **locked to that single option** — no mode cycling, no tap-to-switch, no "tap the time" hint; its controls only operate that option (clocks have no controls).
5. **Independent X/Y sizing (square-able widget)**: the resize arc also stretches the widget **vertically** — dragging right widens, dragging down heightens, so the pill can become a square, not just a wider rectangle. Per-axis adaptive caps and persistence.

## Scope

### Includes

**A. TimeWidget.tsx**
- X button: before `setWidgetVisible(false)`, pause the focused timer if running (`focus === "stopwatch" && stopwatch.running → stopwatchPause()`; same for countdown).
- Focus (auto mode) becomes: running countdown → running stopwatch → **paused countdown** (`!running && remainingMs > 0 && finishedAtMs == null`) → **paused stopwatch** (`!running && accumulatedMs > 0`) → clock. Forced `widgetMode` branches ("clock"/"stopwatch"/"countdown") stay as-is.
- Remove the `widgetMode === "auto" && clock-focus && paused → "resume"` toggle branch (dead after the focus change; ensures the clock pill shows no timer button).

**B. FullscreenClock.tsx**
- New required prop `mode: "stopwatch" | "countdown" | "local" | "country"`; the content is LOCKED to it:
  - label: `t("time.stopwatch")` / `t("time.countdown")` / `t("time.localClock")` / `t("time.countryClock")`.
  - display: stopwatch elapsed / countdown remaining / clock (`country` → `countryTz ?? deviceTz`; `local` → device tz), respecting `presidingPrefs.timeFormat`; date line only for the clock modes.
  - controls: stopwatch → start/pause/reset; countdown → quick-start 5/10/15-min chips when idle (`totalMs === 0`), else start/pause/reset; clocks → none.
- REMOVE: mode state/cycling, the tap-to-cycle hint + `time.tapToCycle` usage, the `fullscreenchange` listener, and any `requestFullscreen`/`exitFullscreen` references (none should remain).
- KEEP: wake lock, best-effort `screen.orientation.lock("landscape")` attempt (silently no-ops without native fullscreen), Escape → `onClose`, exit button (top-right), controls auto-hide (~4 s) while a timer runs + tap to reveal, mutual-exclusion disabled states + `time.timerBusy` hint.

**C. TimeView.tsx**
- Remove the top-level "Pantalla completa" launcher and the `requestFullscreen`/`exitFullscreen` calls.
- State: `fullscreenMode: "stopwatch" | "countdown" | "local" | "country" | null`; render `{fullscreenMode && <FullscreenClock mode={fullscreenMode} onClose={() => setFullscreenMode(null)} />}`.
- Add a small `fullscreen` icon button inside EACH card header (`ml-auto`, `aria-label={t("time.fullscreen")}`): Stopwatch → `"stopwatch"`, Countdown → `"countdown"`, Local clock → `"local"`, Country clock → `"country"`.

### Excludes

- i18n additions (labels already exist; `time.tapToCycle` stays in the dictionary but becomes unused).
- The user's `floatedKind` / `floatClock` / disabled-by-pill logic (untouched).

**D. Independent X/Y sizing — TimeWidget + store + types**
- `TimeToolsState.widgetScale: number` → `{ x: number; y: number }`; `normalizeTimeTools` migrates legacy numbers (`{ x: n, y: n }`) and clamps each axis to 0.8–2.0; `setWidgetScale(x, y)`.
- TimeWidget: `displayScaleX`/`displayScaleY`; `applyPreview(offset, sx, sy)` → `translate(...) scale(sx, sy)`; the arc drag maps `dx → sx` (`+dx/120`) and `dy → sy` (`+dy/120`) — dragging right/down increases size — each clamped to its per-axis adaptive cap (`capX = min(2, (vw−16)/offsetWidth)`, `capY = min(2, (vh−16)/offsetHeight)`); adaptive effect computes both caps; the % badge shows `W×H%` while dragging; double-click on the arc resets both axes to 1; the move gesture uses the scale pair captured at drag start.
- The horizontal auto-shift (keep-on-screen) during resize stays (uses `sx`); vertical growth is bounded by `capY` (origin bottom, grows upward).

## Deliverables

- [ ] X closes + pauses the shown timer
- [ ] Paused timers keep the pill (with ▶ resume)
- [ ] Clock pill has no timer toggle
- [ ] Per-card dedicated fullscreens (locked), overlay-only (no native fullscreen API)

## Acceptance Criteria

- [ ] Stopwatch running → X → pill closes AND the stopwatch is paused (value kept; resumable)
- [ ] Paused stopwatch/countdown → pill keeps showing the frozen time + ▶
- [ ] Clock pill: only time + grip + X
- [ ] Each card's fullscreen button opens a locked fullscreen for that option; clocks show no controls; no mode switching; no browser fullscreen notice
- [ ] Arc drag widens AND heightens (right/down = bigger, up/left = smaller); the shape can become square; per-axis caps keep it on screen; the size persists across reloads
- [ ] `npm run type-check` passes; live puppeteer verification

## Notes

- Overlay-only fullscreen keeps: wake lock, Esc close, auto-hide. Browser UI (address bar) remains visible — accepted trade-off.

## Completion Evidence (2026-10-19)

- Implemented all five objectives: X = close + pause (value kept); paused timers keep the pill (frozen time + ▶); clock pill has no timer button; per-card LOCKED fullscreens with zero native Fullscreen API usage (`requestFullscreen|document\.exitFullscreen|fullscreenchange|fullscreenElement` = 0 matches); independent X/Y sizing (`widgetScale: {x, y}`, legacy-number migration in `normalizeTimeTools`, per-axis adaptive caps, `scale(sx, sy)`, `W×H%` badge, dbl-click resets both axes).
- Live verification (headless Chrome):
  - X → pill hidden + stopwatch paused at 00:00:01 (frozen, "Resume" shown); resume → pause via pill → pill keeps the frozen time + ▶
  - Clock pill (float button): time + grip + X only
  - Fullscreens: Stopwatch → its controls only; Local Clock / Country Time → time + date, no controls; no mode switching on time tap; `document.fullscreenElement === null` (no browser notice)
  - Square resize: drag right+down → `scale(1.5, 1.33333)`; persists across a fresh page; double-click resets to `scale(1, 1)`
- `type-check` + `build` green.
