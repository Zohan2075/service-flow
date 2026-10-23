---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 8
status: completed
created: "2026-10-23"
updated: "2026-10-23"
---

# Phase 8: Timer Refurbish (Ring, States, Extend/Warn/Repeat, Title, Wake Lock)

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Refurbish the two Time-tab timers (stopwatch + countdown) with more logic and a refined look that respects the global theme (custom accent, light/dark, user surfaces):

1. Refined cards with a large monospace display, a **progress ring in the user's accent color** (countdown), a unified control bar, and explicit **state chips** (Ready / Running / Paused / Finished).
2. Countdown upgrades: **extend +1/+5 min while running**, **warnings at 1 min and 10 s** (toast; 10 s also a short beep), and a **Repeat** button when finished.
3. While any timer runs: **time shown in the browser tab title** and **screen kept awake** (wake lock, best effort).
4. Coherent reflection: the fullscreen countdown uses the same ring.

## Scope

### Includes

**A. Store — `types/data.ts` + `store.ts` (additive)**
- Countdown gains `warned60: boolean; warned10: boolean` (defaults false; normalized via `Boolean(...)`).
- `countdownStart`: reset both flags. `countdownReset`: defaults.
- NEW `countdownExtend(extraMs: number)`: running → `endsAtMs += extraMs`, `totalMs += extraMs`; paused-with-value → `remainingMs += extraMs`, `totalMs += extraMs`; reset `warned60` if the new remaining > 60 000 and `warned10` if > 10 000.
- NEW `markCountdownWarning(which: 60 | 10)`: sets the matching flag.

**B. Warning/alarm logic — `TimeWidget.tsx` (`useCountdownAlert`) + `alertSound.ts`**
- Add `playWarningBeep()` to `alertSound.ts` (single short pulse, e.g. 660 Hz ~120 ms; same lazy AudioContext/try-catch pattern).
- In the alert hook's 1 s check (while running): before the finish check —
  - `remaining <= 60_000 && remaining > 10_000 && totalMs > 60_000 && !warned60` → `markCountdownWarning(60)` + `toast(t("time.warning1m"))`.
  - `remaining <= 10_000 && totalMs > 10_000 && !warned10` → `markCountdownWarning(10)` + `toast(t("time.warning10s"))` + `playWarningBeep()`.
  - Finish behavior unchanged.

**C. NEW `web/src/components/presiding/TimerRing.tsx`** (shared)
- SVG ring: viewBox 0 0 100 100; track `stroke-slate-200 dark:stroke-slate-800`; progress circle rotated −90°, `strokeLinecap="round"`, stroke `rgb(var(--sf-primary))` (theme accent), `strokeDasharray = C`, `strokeDashoffset = C * (1 - progress)`, `style={{ transition: "stroke-dashoffset 0.9s linear" }}`; `className` prop for sizing (`w-40 h-40 md:w-44 md:h-44` default); `children` centered absolutely (`relative` wrapper + `absolute inset-0 grid place-items-center`).
- Props: `progress: number` (0–1), `strokeWidth?: number` (default 7), `className?`, `children`.

**D. `TimeView.tsx` — refined cards (stopwatch + countdown only; clock cards untouched)**
- Shared additions: a **state chip** in each of the two cards (small pill): Ready (slate), Running (amber), Paused (`bg-primary/10 text-primary`), Finished (red). Use new i18n keys (below).
- **Stopwatch card**: display upgraded to `text-5xl` (≈ `TIME_TEXT_CLASS` variant, tabular); state chip; unified control bar (restyled ActionButton/ResetButton: `rounded-xl min-h-12 px-5`, motion tap; running action = amber, idle/paused = primary) and the existing busy hint; fullscreen button unchanged.
- **Countdown card**: after the header/state chip — the **TimerRing** wrapping the big display (`progress` = `totalMs > 0 ? remaining/ total : 1`; frozen when paused; 0 when finished); when finished show `time.done` + a **Repeat** primary button (`countdownStart(countdown.totalMs)`); when running show a chips row **“+1 min” / “+5 min”** (`countdownExtend(60_000/300_000)`); presets/custom inputs only when not running (disable or hide while running — keep visible but disabled is fine); unified controls; busy hint kept.
- Preserve all existing logic: `floatedKind` blocking, `stopwatchBlocked/countdownBlocked/busy` flags, mutual exclusion, `toggleStopwatch/toggleCountdown`, `floatClock` buttons, fullscreen buttons, countdown quick-start values, i18n usage.
- Progress values derive from store (`endsAtMs`, `remainingMs`, `totalMs`) + the local `nowMs` tick.

**E. `FullscreenClock.tsx`** — countdown mode: wrap the giant time in the same **TimerRing** (sizing via className, e.g. `w-[min(72vw,58vh)]`), progress identical. Other modes unchanged.

**F. Tab title + wake lock (global, live while a timer runs)**
- NEW `web/src/lib/wakeLock.ts`: `export function useWakeLock(active: boolean): void` — requests `screen` when active, releases on cleanup/inactive, re-acquires on `visibilitychange` while active; typed via local interfaces (no `any`); every call `try/catch`/`.catch(() => {})`; no-op when unsupported.
- `TimeWidget.tsx`:
  - `useWakeLock(stopwatch.running || countdown.running)`.
  - Tab title effect: capture the base title once on mount; while a timer runs set `document.title = \`${shortTime} · ${label} · ${baseTitle}\`` (label: `t("time.stopwatch")`/`t("time.countdown")`; `shortTime` = `MM:SS`, or `H:MM:SS` when ≥ 1 h) updated on the existing 1 s tick; restore `baseTitle` when nothing runs and on unmount.
- `FullscreenClock.tsx`: replace its inline wake-lock effect with `useWakeLock(true)` (coherence, less duplication).

**G. i18n (EN/ES)**
- `time.warning1m` ("1 minute left"/"Queda 1 minuto"), `time.warning10s` ("10 seconds left"/"Quedan 10 segundos"), `time.repeat` ("Repeat"/"Repetir"), `time.stateReady` ("Ready"/"Listo"), `time.stateRunning` ("Running"/"Corriendo"), `time.statePaused` ("Paused"/"Pausado"), `time.stateFinished` ("Finished"/"Terminado").

### Excludes

- Laps, history, multiple simultaneous timers, vibration/browser notification (not selected).
- Clock cards, program part timers, widget geometry, mutual-exclusion rules.

## Deliverables

- [ ] Ring component + countdown ring (card + fullscreen)
- [ ] State chips + refined unified controls (theme-driven colors only)
- [ ] Extend +1/+5, warnings 1 min/10 s (toast + short beep), Repeat
- [ ] Tab title while running; wake lock while running
- [ ] i18n EN/ES keys

## Acceptance Criteria

- [ ] Ring reflects remaining/total with the user's accent; smooth per-second decrease; frozen when paused; empty when finished
- [ ] +1/+5 extend a running countdown (remaining and ring grow; 60 s warning can fire again after extension)
- [ ] Warnings fire once per run at ≤60 s and ≤10 s (toast; short beep at 10 s); Repeat restarts the last duration
- [ ] Tab title shows `MM:SS · timer · ServiceFlow` while running; restored when stopped
- [ ] Wake lock requested while running and released when stopped (spy-verified; graceful no-op)
- [ ] Light/dark + custom accent respected (no hardcoded accent colors); existing logic/behaviors intact
- [ ] `npm run type-check` + `build` green; live puppeteer verification

## Notes

- Warning thresholds are guarded by `totalMs` so short countdowns don't fire an immediate 60 s warning.
- All new visuals must use theme tokens (`primary`, `surface`, `canvas`, slate palette + dark variants).

## Completion Evidence (2026-10-23)

- Implemented: countdown `warned60/warned10` + `countdownExtend` + `markCountdownWarning` (store, additive with safe defaults); `playWarningBeep()`; shared `TimerRing` (accent `rgb(var(--sf-primary))`, slate/dark track, 0.9 s linear sweep); state chips + refined stopwatch/countdown cards (big display, ring, unified `size="lg"` controls, Repeat, +1/+5 extend chips, presets hidden while running); fullscreen countdown ring + shared `useWakeLock`; tab-title indicator; i18n EN/ES (7 keys).
- Live verification (headless Chrome, 390×720):
  - Running: chip "Running", ring stroke `rgb(32, 148, 243)` (accent), offset increases over time; +1 min chip visible; presets hidden; tab title `01:08 · Countdown · ServiceFlow`
  - 1-minute warning toast fired; +5 min extend `00:01:00 → 00:05:59`; paused → chip "Paused" + ring/time frozen
  - 12 s countdown: 10 s warning toast; finished → "Finished", `00:00:00`, Repeat visible, title restored to `ServiceFlow`
  - Repeat: disabled while the floating pill is open (user's `floatedKind` rule); after closing the pill (×) it restarts the countdown (`00:00:11`, Running)
  - Wake lock spy: 1 request while running, 1 release after reset
  - Fullscreen countdown: ring present with the accent stroke
- `type-check` + `build` green.
