---
type: planning
entity: phase
plan: "responsive-and-zoom-lock"
phase: 2
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 2: Visual Viewport Anchoring (save button fix follow-up)

> Part of [responsive-and-zoom-lock](../plan.md)

## Objective

User reports the entry Save button is still not visible on their device after Phase 1. Live-browser diagnosis (headless Chrome, real app, 390×640): the submit button renders correctly at `top 576 / bottom 624` of `innerHeight 640` — but modal overlays use `fixed inset-0`, which anchors to the **layout viewport**. On phones this sits behind the browser's bottom URL/gesture bar; while typing, the iOS keyboard covers the pinned footer. Anchor modal overlays to the **visual viewport** instead.

## Scope

### Includes

1. NEW `web/src/components/ViewportSync.tsx` (`"use client"`, null render): mirrors `window.visualViewport` into CSS custom properties on `<html>`:
   - `--app-vv-height` = `visualViewport.height` px
   - `--app-vv-top` = `visualViewport.offsetTop` px
   - updates on `resize` + `scroll`; full cleanup; no-op when unsupported (CSS fallback handles it)
2. `web/src/components/Providers.tsx`: mount `<ViewportSync />` next to `<ZoomLock />`.
3. Both modal overlays (`AddEntryModal.tsx`, `InterestedPersonModal.tsx`): keep `fixed inset-0 …` and add
   `style={{ top: "var(--app-vv-top, 0px)", height: "var(--app-vv-height, 100dvh)" }}`
   (inline `height` overrides `bottom` anchoring; unsupported browsers fall back to current `inset-0` behavior).
4. Fix invalid safe-area padding in both pinned footers: `pb-[calc(env(safe-area-inset-bottom)+1rem)]` → `pb-[calc(env(safe-area-inset-bottom)_+_1rem)]` (Tailwind converts `_` to spaces; the old value was invalid CSS and silently dropped).
5. `web/src/app/layout.tsx` viewport: add `interactiveWidget: "resizes-content"` so Android Chrome resizes the layout viewport when the keyboard opens.

### Excludes

- Modal animations; ConfirmDialog (centered, not affected); desktop layout changes.

## Prerequisites

- [x] Root cause diagnosed via live app + puppeteer-core metrics (2026-09-30)
- [x] `Viewport.interactiveWidget` supported in Next 15.1 types

## Deliverables

- [ ] `ViewportSync.tsx` + provider mount
- [ ] Visual-viewport inline sizing on both modal overlays
- [ ] Fixed safe-area calc syntax in both footers
- [ ] `interactiveWidget` viewport meta

## Acceptance Criteria

- [ ] Live puppeteer test at 390×640: submit button still fully within viewport
- [ ] With simulated visual viewport shrink (keyboard), overlay + pinned footer stay inside the reduced viewport
- [ ] Desktop unchanged (visualViewport = window size)
- [ ] `npm run type-check` passes
- [ ] No behavior/handler/i18n changes

## Notes

- Diagnostics: `web/node_modules` got `puppeteer-core` via `npm install --no-save` (not in package.json); test script at `%TEMP%\opencode\modal-live-test.js`.
- CSS fallback chain: `var(--app-vv-height, 100dvh)` — modern browsers use dvh until the effect runs and on unsupported ones the declaration is invalid and `inset-0` applies.
