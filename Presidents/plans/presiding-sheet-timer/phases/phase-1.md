---
type: planning
entity: phase
plan: "presiding-sheet-timer"
phase: 1
status: active
created: "2026-08-04"
updated: "2026-08-04"
---

# Phase 1: Project Scaffolding & Infrastructure

> Part of [presiding-sheet-timer](../plan.md)

## Objective

Initialize the Next.js + TypeScript project with all foundational infrastructure: Tailwind CSS, i18next (EN/ES), localStorage persistence layer, mobile-first layout shell, and dark/light theme support. No timer or presiding sheet functionality yet -- just the app shell.

## Scope

### Includes

- `npx create-next-app` with TypeScript, Tailwind CSS, App Router
- Install and configure `i18next` + `react-i18next` (client-side only, no routing)
- Define translations for all UI strings in English and Spanish (`src/i18n/locales/`)
- Create `localStorage` data layer: meeting config model, read/write hooks
- Define TypeScript types for `MeetingConfig`, `Section`, app preferences
- Mobile-first layout: sticky header, scrollable content area, bottom nav skeleton
- Dark/light theme with Tailwind `class` strategy + toggle state in localStorage
- PWA foundation: `manifest.json`, basic metadata

### Excludes (deferred to later phases)

- Section editing UI (Phase 2)
- Timer logic or timer UI (Phase 3)
- Actual content in bottom nav tabs
- Deploy setup (Phase 3)

## Prerequisites

- Node.js 18+ and npm installed
- Vercel account (for later deploy)

## Deliverables

- [ ] Working Next.js app that starts with `npm run dev`
- [ ] Language toggle (EN <-> ES) in the header that switches all UI strings
- [ ] Theme toggle (dark <-> light) in the header
- [ ] Empty app shell with proper mobile-first layout
- [ ] `src/types/` with all TypeScript interfaces
- [ ] `src/lib/storage.ts` with localStorage read/write utilities
- [ ] `src/i18n/` with English and Spanish locale files covering all required strings
- [ ] `public/manifest.json` with PWA metadata

## Acceptance Criteria

- [ ] `npm run dev` starts without errors
- [ ] Toggling language immediately changes UI text on screen
- [ ] Toggling theme switches between dark and light mode
- [ ] Language and theme preferences survive page refresh (localStorage)
- [ ] App renders correctly at 360px viewport width without horizontal scroll
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 2 | blocked-by | Phase 2 builds on the layout, i18n, and data layer from Phase 1 |
| 3 | blocked-by | Phase 3 builds on everything from Phases 1 and 2 |

## Notes

- Use `shadcn/ui` or keep it dependency-light with pure Tailwind; decision deferred to implementation plan.
- i18next must be configured for client-side only (no SSR locale detection) to keep the app static-exportable.
