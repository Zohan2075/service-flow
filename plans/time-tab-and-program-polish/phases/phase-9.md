---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 9
status: completed
created: "2026-10-25"
updated: "2026-10-25"
---

# Phase 9: Fullscreen Time Selection, No Pill From Fullscreen, Instant Presets

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Fix the timer logic around fullscreen and presets:

1. **Fullscreen countdown**: offer time options (presets) **and a custom minutes:seconds input** to run directly there.
2. **Closing the fullscreen immediately stops the timer/clock and never shows a floating pill.** Today every start/resume sets `widgetVisible: true`, so leaving fullscreen leaves a floating clock behind.
3. **Selecting a preset in the Time card starts the countdown immediately** (today it only selects the value; the user must press Start).

## Scope

### Includes

**A. Shared preset list — NEW `web/src/lib/timePresets.ts`**
- `export const COUNTDOWN_PRESETS_MIN = [1, 3, 5, 10, 15, 30, 45, 60] as const;`
- `TimeView.tsx`: import it instead of the local constant (same values; no behavior change).
- `FullscreenClock.tsx`: import it; remove the local `QUICK_START_MIN`.

**B. `FullscreenClock.tsx` — countdown time selection + pill suppression**
- Add `const setWidgetVisible = useStore((s) => s.setWidgetVisible);`
- Local state `customMin`, `customSec` (digit-only strings; minutes 0–999, seconds 0–59 — same sanitizing as the card). `customTotalMs = (min * 60 + sec) * 1000`.
- Helper `startCountdown(ms: number)`: `if (ms <= 0 || countdownBlocked) return; countdownStart(ms); setWidgetVisible(false);`
- Replace the countdown controls block:
  - **Running**: `Pause` (amber) + `Reset` — unchanged.
  - **Not running**: a column with
    - if `countdownResumable`: `Resume` (primary, `countdownResume()` + `setWidgetVisible(false)`) + `Reset`;
    - a compact preset row (`COUNTDOWN_PRESETS_MIN`, flex-wrap, theme-dark chips); each click → `startCountdown(min * 60_000)` (runs immediately);
    - a custom row: minutes input `:` seconds input + `Start` button (`startCountdown(customTotalMs)`, disabled when `customTotalMs <= 0 || countdownBlocked`). Inputs styled for the dark overlay (`border-white/15 bg-white/5 text-white`, centered mono, `aria-label` = `t("time.minutes")` / `t("time.seconds")`, `placeholder="0"`, `inputMode="numeric"`).
  - Remove the old `countdownQuickStart`-only quick-start block and the `countdownStartDisabled` usage tied to it (keep the variable only if still needed; otherwise delete).
- **Suppress the pill on every fullscreen start/resume**: `toggleStopwatch` (when starting) and `toggleCountdown` (when resuming) call `setWidgetVisible(false)` after the action.
- **`requestClose`**: pause the running timer (existing) **and** `setWidgetVisible(false)` before `onClose()` — closing fullscreen stops the timer and never leaves a floating clock.

**C. `TimeView.tsx` — preset = set + run**
- `selectPreset(min)`:
  ```ts
  setPresetMin(min);
  setCustomMin("");
  setCustomSec("");
  if (countdownBlocked || countdownBusy) return;
  if (!widgetVisible && (widgetMode === "clock" || widgetMode === "stopwatch")) setWidgetMode("auto");
  countdownStart(min * 60_000);
  ```
  (Starting from the card still shows the pill — that behavior is unchanged.)
- Preset chips: `disabled={countdownBlocked || countdownBusy}`.

**D. `OptionChip.tsx` — optional `disabled` prop (backward compatible)**
- `disabled?: boolean` default `false`; pass to the button; skip hover/tap animations and add `cursor-not-allowed opacity-50` when disabled. Existing call sites unchanged.

### Excludes

- Store action signatures (`stopwatchStart`/`countdownStart`/`countdownResume` keep `widgetVisible: true` — the card relies on it; fullscreen suppresses afterwards).
- Extend/warnings/repeat/title/wake-lock (Phase 8 behavior stays).
- Clock cards, program timers, widget geometry, mutual-exclusion rules.

## Acceptance Criteria

- [ ] Fullscreen countdown (idle/paused/finished) shows preset options + custom min:sec + Start; preset click runs immediately; custom Start runs the typed time
- [ ] Closing the fullscreen stops the running timer (paused, value kept) and **no floating pill appears** (`widgetVisible === false`)
- [ ] Starting/resuming from fullscreen never shows the pill (before or after closing)
- [ ] Time card: clicking a preset starts the countdown immediately (ring runs; no extra Start press); still blocked by the pill-exclusivity rule (chips disabled)
- [ ] Pause/resume ring continuity and Phase 8 features intact
- [ ] `npm run type-check` + `build` green; live puppeteer verification

## Notes

- "Stop" on fullscreen close = pause with the value kept (consistent with the earlier exit-pauses decision); the key change is that it no longer surfaces the pill.
- All new visuals use theme tokens / the dark overlay palette; no hardcoded accent colors.

## Completion Evidence (2026-10-25)

- Implemented: shared `COUNTDOWN_PRESETS_MIN` (`lib/timePresets.ts`); fullscreen countdown selection (8 presets + custom min:sec + Start; Resume/Reset when paused; Pause/Reset when running) with pill suppression on every start/resume and in `requestClose`; Time card `selectPreset` starts immediately (chips disabled when blocked/busy); additive `OptionChip` `disabled`.
- Live verification (headless Chrome, 390×720):
  - Card: clicking "1 min" → **Running immediately** (`00:00:59`, pill visible as designed); paused → clicking "3 min" → Running `00:02:59`
  - Fullscreen idle: presets `1/3/5/10/15/30/45/60` + Minutes/Seconds inputs + Start (disabled until a time is typed)
  - Fullscreen "5 min" preset → runs immediately (`00:04:58`, decreasing), **no pill**
  - Fullscreen custom `0:20` → Start → `00:00:19`; Pause → frozen `00:00:18` + Resume; presets/custom still available while paused
  - Close fullscreen (Exit) → timer **paused** (value kept), **no floating pill**, tab title restored to `ServiceFlow`
  - Stopwatch fullscreen: start → close → paused, no pill
- `type-check` + `build` green.
