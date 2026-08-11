---
type: planning
entity: phase
plan: "presiding-sheet-timer"
phase: 3
status: pending
created: "2026-08-04"
updated: "2026-08-04"
---

# Phase 3: Timer & Deploy

> Part of [presiding-sheet-timer](../plan.md)

## Objective

Implement the meeting timer view with master and per-section countdowns, visual warnings, and controls. Then finalize PWA configuration and deploy to Vercel.

## Scope

### Includes

- Timer view (separate tab in the bottom nav from the presiding sheet)
- Master countdown timer starting at sum of all section durations
- Current section highlight with its individual countdown
- Timer controls: Start, Pause, Reset (full meeting), Skip to next section
- Visual warning when a section has 1 minute remaining (color change / pulse)
- Overtime alert when a section exceeds its duration (red, continues counting up)
- Meeting progress bar (percentage of sections completed vs total)
- Auto-advance to next section toggle (default: manual)
- PWA: `manifest.json` with proper icons, name, theme color
- Deploy to Vercel (`vercel --prod`)

### Excludes

- No sound alerts (beyond what CSS visual cues provide)
- No notification API
- No data export/import (future enhancement)

## Prerequisites

- [ ] Phase 2 complete (presiding sheet with saved section config)
- [ ] Vercel CLI installed and authenticated for deployment

## Deliverables

- [ ] Timer page with master countdown displayed prominently
- [ ] Current section name and assignee shown above section timer
- [ ] Per-section timer counting down from section duration
- [ ] Start, Pause, Reset, Skip controls (touch-friendly, >=44px)
- [ ] 1-minute warning visual
- [ ] Overtime visual (red highlight on timer)
- [ ] Meeting progress bar
- [ ] Bottom nav with Timer and Presiding Sheet tabs
- [ ] App deployed and accessible at a Vercel URL

## Acceptance Criteria

- [ ] Master timer starts at sum of all section durations and counts down per second
- [ ] Starting the timer begins countdown for the first section
- [ ] Pausing stops all timers; resuming continues from where it left off
- [ ] Skipping moves to the next section and resets the section timer
- [ ] Section timer turns yellow/orange at 1 minute remaining
- [ ] Section timer turns red when overtime, continues counting up
- [ ] Progress bar reflects completed sections / total sections
- [ ] Timer functions correctly when browser tab is in background
- [ ] App is installable as PWA on mobile (manifest loads without errors)
- [ ] Deployed app loads correctly on Vercel

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 1 | blocked-by | Uses layout, theme, and i18n infrastructure |
| 2 | blocked-by | Reads section list from presiding sheet config in localStorage |

## Notes

- Timer uses `setInterval` at 1-second intervals with `Date.now()` delta checks to correct for drift when tab is in background.
- The master timer is the sum of section durations, not a separate config value.
- Auto-advance should be a toggle setting with default = off (chairman prefers manual control per S-38).
