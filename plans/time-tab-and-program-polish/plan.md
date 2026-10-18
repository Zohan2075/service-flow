---
type: planning
entity: plan
plan: "time-tab-and-program-polish"
status: completed
created: "2026-10-17"
updated: "2026-10-17"
---

# Plan: Time Tab & Program Dashboard Polish

## Objective

1. Improve typography (font sizes/hierarchy, tabular numerals) across the Program (Presiding) dashboard; slightly enlarge the existing part-timer circles and their fonts.
2. Add a third tab **"Tiempo" / "Time"** to the Presiding page: a multi-purpose clock panel with **Stopwatch**, **Countdown**, **Local clock**, and **Country clock** (geolocation-detected, changeable at any time).
3. A **global floating mini-clock** (compact, resizable drag-handle pill) usable while navigating anywhere in the app.

## Requirements

### Functional

- [ ] TimerButton circles: `size-12/14` → `size-14/16`; time text +1 step; reset button `size-11` → `size-12`; icons +1 step
- [ ] Program dashboard: type-scale bumps in ProgramView/ActiveTimerBar (smallest `text-[10px]` → `text-xs`; primary titles +1 step; `tabular-nums` on all time displays); no layout/structure changes
- [ ] Presiding tabs: 3rd option Tiempo/Time, `?tab=time` URL sync
- [ ] Stopwatch (single): start/pause/reset, persists across navigation & reloads (timestamps in store)
- [ ] Countdown: presets + custom min/sec, start/pause/reset, completion alert (Web Audio beep + toast)
- [ ] Local clock: live device time/date, locale-aware
- [ ] Country clock: "Detectar mi país" → geolocation → BigDataCloud (country name) + timeapi.io (IANA tz); fallbacks to device tz; manual timezone selector (changeable anytime)
- [ ] Floating pill (all dashboard pages): priority countdown → stopwatch → country → local; pause/resume of the active clock, tap → `/presiding?tab=time`, X to hide (auto-shows when a stopwatch/countdown starts), **drag-handle resize** (scale 0.8–1.6 persisted)
- [ ] i18n: `nav.time` + `time.*` keys in EN/ES

### Non-Functional

- [ ] Offline-first: all persisted via store; country detection degrades gracefully (device tz)
- [ ] No changes to existing program-part timer behavior
- [ ] type-check + build green; live verification with puppeteer

## Scope

### In Scope

- `web/src/components/presiding/ProgramView.tsx` (typography + circles), `ActiveTimerBar`
- `web/src/app/(dashboard)/presiding/page.tsx` (3rd tab)
- NEW `web/src/components/presiding/TimeView.tsx`, NEW `web/src/components/TimeWidget.tsx`
- `web/src/app/(dashboard)/layout.tsx` (mount widget)
- `web/src/lib/store.ts` + `web/src/types/data.ts` (new `timeTools` slice)
- `web/src/lib/i18n.tsx`

### Out of Scope

- Multiple simultaneous stopwatches (user chose single)
- Changes to program part timers / session log logic
- Alarm sounds beyond a synthesized beep

## Definition of Done

- [ ] All three phases completed and verified (type-check, build, live puppeteer)
- [ ] Widget usable from any dashboard page; resize + pause work; countdown alerts fire globally
- [ ] Plans/todo updated

## Testing Strategy

- type-check + build; live puppeteer: tab render, stopwatch persistence across navigation, countdown alert, country detection fallback, widget resize/navigation
- Screenshots for typography verification

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Program typography + timer circles | ProgramView/ActiveTimerBar size bumps | completed |
| 2 | Time tab (clocks) | Store slice, TimeView, 3rd tab, i18n | completed |
| 3 | Global floating widget | TimeWidget, resize, alerts, layout mount | completed |

## Risks & Open Questions

| Risk | Impact | Mitigation |
|---|---|---|
| Typography bumps cause layout shifts in dense program rows | Medium | +1 step max; visual screenshots; no structure changes |
| External APIs (BigDataCloud/timeapi.io) fail or are blocked | Low | Device-timezone fallback + manual selector; both verified `CORS: *` |
| Geolocation permission denied | Low | Explicit fallback path + manual selector (no repeated prompts) |
| Countdown alert while on another page | Low | Widget ticks globally as the alert owner |
| Persist merge for new slice | Low | New top-level slice with defaults (shallow merge safe) |

## Changelog

### 2026-10-17

- Plan created from user request. User decisions: functions = stopwatch (single) + countdown + local clock + country clock; floating pill = compact + user-resizable; country detection = geolocation + free API + fallback + manual selector; typography = improve with Inter.
- Phase 1 completed: 24 class-only typography/size edits in ProgramView (circles 48→56px mobile / 56→64px desktop; times +1 step + tabular-nums; headings bumped). Verified live at 375px + desktop (no overflow). type-check + build green.
- Phase 2 started: Time tab (stopwatch, countdown, local clock, country clock) + `timeTools` store slice + i18n.
- Phase 2 completed: `timeTools` slice, `TimeView` (4 clocks, detection via BigDataCloud + timeapi.io with fallback + manual selector), 3rd tab with `?tab=time`, 23 i18n keys. Live-verified (stopwatch persistence, countdown alert, real detection pipeline). type-check + build green.
- Phase 3 started: global floating mini-clock (resizable, alert owner).
- Phase 3 completed: resizable floating pill on every dashboard page (focus priority, pause/resume, tap-to-open, hide, drag-grip resize persisted 0.8–1.6, global countdown alert); fixed a `widgetVisible` nesting bug found during live verification. Full live pass green (persistence across reload, cross-page alert, resize, hide). type-check + build green. **Plan complete — awaiting user manual QA.**
