---
type: planning
entity: plan
plan: "presiding-sheet-timer"
status: active
created: "2026-08-04"
updated: "2026-08-04"
---

# Plan: Presiding Sheet & Timer

## Objective

Build a mobile-first, client-only web app that serves as a digital presiding sheet and meeting timer for the Jehovah's Witnesses midweek meeting (Our Christian Life and Ministry), compliant with S-38 guidelines. The app runs entirely in the browser using localStorage — no backend, no database, no authentication.

## Motivation

The presiding brother needs a tool to manage the meeting program (edit sections, assign names, adjust times) and conduct the meeting on time (countdown timers per section, master timer for the full 1h45m). Running as a PWA on a mobile device keeps it accessible in the Kingdom Hall without internet dependency.

## Requirements

### Functional

- [ ] Default meeting structure following S-38 (Treasures, Field Ministry, Living as Christians, etc.)
- [ ] Every section has modifiable title (English + Spanish) and duration (minutes)
- [ ] User can add/remove subsections under "Apply Yourself to the Field Ministry"
- [ ] Optional name assignment field per section for brother/sister names
- [ ] Full i18n: English and Spanish (UI labels + section titles)
- [ ] Master countdown timer for the full meeting (1h45m / 105 min total)
- [ ] Per-section countdown timer with visual warnings (1 min remaining, overtime alert)
- [ ] Timer controls: start, pause, reset, skip to next section
- [ ] Meeting progress bar showing overall completion
- [ ] Language toggle (EN <-> ES) persisted to localStorage
- [ ] Meeting configuration persisted to localStorage

### Non-Functional

- [ ] Mobile-first responsive layout (optimized for 360px-428px screens)
- [ ] Touch-friendly: minimum 44px tap targets
- [ ] Works offline (PWA, no server dependency)
- [ ] Dark/light theme toggle
- [ ] Next.js 14+ App Router + TypeScript + Tailwind CSS
- [ ] Deployed to Vercel

## Scope

### In Scope

- Digital presiding sheet with editable sections, durations, and optional name assignments
- Meeting timer/chronometer with master and per-section countdowns
- S-38 default meeting structure as starting template
- English and Spanish localization
- Dark/light theme
- Client-only: all data in localStorage
- PWA capabilities (manifest, installable)
- Vercel deployment

### Out of Scope

- Backend, database, authentication, user accounts
- Stamp system, volunteer tracking, service caps, spreadsheets
- Multi-congregation or multi-user support
- Real-time sync across devices
- Public talk / weekend meeting support
- Sound system integration
- Note-taking features

## Definition of Done

- [ ] App deploys and runs on Vercel
- [ ] User can customize all section titles and times (EN + ES)
- [ ] User can add/remove subsections under Field Ministry
- [ ] User can optionally assign names to any section
- [ ] Language toggle switches all UI text between English and Spanish
- [ ] Timer counts down master (105 min) and current section simultaneously
- [ ] Timer warns at 1 minute remaining, alerts on overtime
- [ ] Timer supports start, pause, reset, skip-to-next
- [ ] Configuration survives page refresh (localStorage)
- [ ] App is usable on a mobile phone (360px width) without horizontal scroll
- [ ] Dark/light theme toggle works

## Testing Strategy

- [ ] Manual testing on mobile viewport (Chrome DevTools device mode)
- [ ] Manual testing: all timer states (running, paused, warnings, overtime, skip)
- [ ] Manual testing: section add/remove/edit, name assignment, language toggle
- [ ] Manual testing: localStorage persistence across refresh
- [ ] Manual testing: PWA install on mobile device

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Project Scaffolding & Infrastructure | [Detail](phases/phase-1.md) | active |
| 2 | Presiding Sheet | [Detail](phases/phase-2.md) | pending |
| 3 | Timer & Deploy | [Detail](phases/phase-3.md) | pending |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| S-38 document may have timing nuances not covered | Low | Use default 105min total; all times are editable by user anyway |
| localStorage size limits | Low | Meeting config is small (<5KB); well within 5MB limit |
| Next.js static export vs i18n routing | Low | Use client-side i18n only (i18next); avoid Next.js i18n routing to keep it static-friendly |

## Changelog

### 2026-08-04

- Plan created
