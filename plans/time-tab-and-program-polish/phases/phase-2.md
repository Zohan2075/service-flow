---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 2
status: completed
created: "2026-10-17"
updated: "2026-10-17"
---

# Phase 2: Time Tab (Stopwatch · Countdown · Local Clock · Country Clock)

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Add the third Presiding tab **Tiempo/Time** with four clock tools, backed by a new persisted `timeTools` store slice.

## Scope

### Includes

**A. Types** — `web/src/types/data.ts`

```ts
export interface TimeToolsState {
  stopwatch: { running: boolean; startedAtMs: number | null; accumulatedMs: number };
  countdown: { running: boolean; endsAtMs: number | null; remainingMs: number; totalMs: number; finishedAtMs: number | null };
  countryTz: string | null;      // IANA, e.g. "America/Santo_Domingo"
  countryLabel: string | null;   // e.g. "República Dominicana"
  widgetVisible: boolean;
  widgetScale: number;           // 0.8 – 1.6
}
```

**B. Store slice** — `web/src/lib/store.ts` (new top-level `timeTools` slice + actions, following existing slice patterns):

- `timeTools` initial: stopwatch `{running:false, startedAtMs:null, accumulatedMs:0}`; countdown `{running:false, endsAtMs:null, remainingMs:0, totalMs:0, finishedAtMs:null}`; country nulls; `widgetVisible:false`; `widgetScale:1`.
- Actions: `stopwatchStart()`, `stopwatchPause()`, `stopwatchReset()`, `countdownStart(totalMs)`, `countdownPause()`, `countdownReset()`, `countdownTick()` (or completion handled by UI: `finishCountdown()` setter), `setCountryClock(tz: string | null, label: string | null)`, `setWidgetVisible(visible: boolean)`, `setWidgetScale(scale: number)` (clamped 0.8–1.6).
- Semantics: stopwatch `accumulatedMs` + `startedAtMs` (running). Countdown `endsAtMs` (running anchor) / `remainingMs` (paused); `countdownStart` also sets `widgetVisible: true`; `stopwatchStart` also sets `widgetVisible: true`.

**C. NEW `web/src/components/presiding/TimeView.tsx`** — four cards (styled consistently with the app: `bg-surface rounded-2xl border shadow-card`):

1. **Cronómetro** — big `font-mono tabular-nums` `HH:MM:SS` (~text-4xl); Start/Pause (primary, `whileTap`), Reset. Derived from store; local 1s interval while running refreshes display (compute from `Date.now()`).
2. **Cuenta regresiva** — preset chips (1/3/5/10/15/30/45/60 min) + custom minutes & seconds inputs; big countdown display; Start/Pause/Reset; on reaching 0 → `finishedAtMs` set, Web Audio beep (short oscillator, no assets) + `toast.success(t("time.countdownDone"))`; display flashes until reset/start.
3. **Reloj local** — live `HH:MM:SS` + date, `Intl`-formatted per app language.
4. **Hora del país** — live clock for `countryTz` with `countryLabel` + UTC offset label; **"Detectar mi país"** button:
   - `navigator.geolocation.getCurrentPosition` (only on press) →
   - `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=..&longitude=..&localityLanguage={lang}` → `countryName`, `countryCode` (verified CORS `*`) →
   - `https://timeapi.io/api/TimeZone/coordinate?latitude=..&longitude=..` → `timeZone` IANA (verified CORS `*`) →
   - `setCountryClock(tz, label)`; any failure → fallback to device tz (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with `toast` info; permission denied → same fallback.
   - **Selector manual**: `<select>` of IANA timezones (`Intl.supportedValuesOf("timeZone")`; fallback: curated list) + "Usar mi zona (dispositivo)" option; applies immediately (works offline).

**D. Tab integration** — `web/src/app/(dashboard)/presiding/page.tsx`:
- Tab union `"program" | "comments" | "time"`; `?tab=time` URL sync; third `SegmentedControl` option (`icon: "timer"`, label `t("nav.time")`); render `<TimeView />` when `tab === "time"`.

**E. i18n** — `web/src/lib/i18n.tsx`: `nav.time` (Time/Tiempo) + `time.*` keys (EN/ES): title, stopwatch, countdown, localClock, countryClock, start, pause, resume, reset, minutes, seconds, presets, detect, detecting, detectingDenied, detected, detectFailed, changeTimezone, deviceZone, countdownDone, offset, noZone.

## Hard Guardrails

- Program-part timer system untouched (Phase 1 area aside).
- Store changes additive (new top-level slice; defaults must hydrate for existing persisted states — zustand shallow merge).
- No new dependencies. External APIs only via `fetch` with graceful fallbacks.

## Deliverables

- [ ] `timeTools` slice + types
- [ ] `TimeView` with 4 clock cards
- [ ] Third tab + URL sync
- [ ] i18n keys EN/ES

## Acceptance Criteria

- [ ] Timer keeps counting across tab switches and page navigations (store-derived)
- [ ] Countdown beeps + toast at 0 regardless of visible tab
- [ ] Country detection works with permission; any failure falls back to device tz; manual selector works offline
- [ ] type-check passes

## Notes

- Times precision: seconds (no milliseconds) for the stopwatch.
- All fetches must be aborted-safe and never block UI.

## Completion Evidence (2026-10-17)

- Implemented: `TimeToolsState` + additive `timeTools` store slice (partialize + normalize merge), `alertSound.ts` (`playAlertBeep`), `TimeView.tsx` (4 cards + `useCountdownCompletion`), 3rd tab (`?tab=time`), 23 i18n keys EN/ES.
- Live verification (headless Chrome + mocked geolocation at Santo Domingo):
  - Cards render; `?tab=time` deep-link activates the tab
  - Stopwatch: 00:00:02 after 2s; kept counting across tab switch (00:00:04)
  - Countdown 3s → "Time's up!" toast + 00:00:00 display
  - Country clock: "Dominican Republic · America/Santo_Domingo · UTC offset: UTC-4"; selector value set; detection ran through BigDataCloud + timeapi.io in-browser
- type-check + build green.
- Note: cards use `<section>` elements (not `div`) — reference for tests/selectors.
