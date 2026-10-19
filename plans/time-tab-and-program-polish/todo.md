---
type: planning
entity: todo
plan: "time-tab-and-program-polish"
updated: "2026-10-19"
---

# Todo: time-tab-and-program-polish

> Tracking [time-tab-and-program-polish](plan.md)

## Active Phase: — (all phases complete, code committed)

### Phase Context

- **Scope**: [Plan](plan.md) — completed
- **Implementation**: inline in phase docs
- **Latest Handover**: N/A
- **Relevant Docs**: N/A

### Pending

- [ ] (Manual) User QA on device: Program typography; Time tab (4 clocks, country detection); floating widget (drag with ⠿, arc resize up to the per-screen max, double-click reset, countdown alert); fullscreen mode (Android rotation lock, auto-hiding controls); stopwatch ↔ countdown exclusivity

### In Progress

### Completed

- [x] Phase 1: Program typography + timer circles <!-- completed: 2026-10-17 --> — circles 48→56px mobile / 56→64px desktop; times +1 step + tabular-nums
- [x] Phase 2: Time tab <!-- completed: 2026-10-17 --> — `timeTools` slice, 4 clocks, country detection (BigDataCloud + timeapi.io + fallback + selector), `?tab=time`, i18n EN/ES
- [x] Phase 3: Global floating widget <!-- completed: 2026-10-17 --> — resize, pause/resume, tap-to-open, hide, global countdown alert; `widgetVisible` bug fixed
- [x] Phase 4: Widget move + arc resize + dividers <!-- completed: 2026-10-17 --> — grip-drag (persisted), arc resize to per-screen max, tab dividers; double-minus CSS bug found & fixed; user's `floatedKind` exclusivity preserved
- [x] Phase 5: Fullscreen + timer mutual exclusion <!-- completed: 2026-10-18 --> — `FullscreenClock` (clock/stopwatch/countdown, wake lock, orientation-lock attempt, auto-hide + tap reveal), stopwatch↔countdown blocked while the other runs
- [x] Code committed by user <!-- completed: 2026-10-19 --> — 5 commits up to `7eb7d03`, working tree clean

### Blocked

## Changelog

### 2026-10-19

- Session resumed after server restart: state verified (all phases completed, all changes committed by the user, tree clean); todo refreshed.

### 2026-10-18

- Phase 5 completed and verified live (fullscreen + mutual exclusion + UX fix: hidden-controls tap no longer switches modes).

### 2026-10-17

- Plan created; phases 1–4 completed (typography, Time tab, widget, move/arc-resize, dividers) with live verification each.
