---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 7
status: completed
created: "2026-10-19"
updated: "2026-10-19"
---

# Phase 7: Crop-Style Resize + Fullscreen Exit Pauses

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Two user requests:

1. **Crop-style resize** for the floating widget: like resizing a crop box — grab a corner handle, the edges **follow the pointer 1:1** while the OPPOSITE corner stays fixed; the widget becomes a real **sized window** (explicit width/height) with **undistorted content centered** inside (no more `scale()` stretching of text/buttons).
2. **Exiting fullscreen pauses the time**: leaving the fullscreen overlay (X / Escape / any path) **pauses** the running stopwatch/countdown (value kept), matching the pill's X behavior.

## Scope

### Includes

**A. Storage — `types/data.ts` + `store.ts`**
- Replace `widgetScale: { x; y }` with `widgetSize: { w: number | null; h: number | null }` (px; `null` = automatic/natural). `setWidgetScale` → `setWidgetSize(w, h)` (clamp: finite positive; each ≤ 4000; `null` allowed).
- `normalizeTimeTools`: legacy values (`number` / `{x,y}`) migrate to `{ w: null, h: null }` (one-time reset of custom sizes — mechanics changed). Default `{ w: null, h: null }`.

**B. `TimeWidget.tsx` — crop-style container**
- Root keeps the fixed bottom-right anchor + drag offset; transform becomes **`translate(-x, -y)` ONLY** (remove all `scale()`); remove `transformOrigin`, the adaptive-cap state/effect (`viewportMaxScale*`), `safeScaleX/Y`, and `applyPreview`'s scale args (move drag preview = translate only).
- Pill container: `rounded-3xl` (window-like; ≈ identical to the old pill when natural) + `min-w-fit min-h-fit`; when `widgetSize.w/h` ≠ null apply explicit `style={{ width, height }}` (px).
- **Crop handle at the TOP-LEFT**: absolute wrapper (`-top-1.5 -left-1.5 size-6`, `touch-none cursor-nwse-resize`, `aria-label={t("time.resize")}`) containing a crop-like L-bracket (`size-3.5 rounded-tl-lg border-l-2 border-t-2 border-slate-400/80 group-hover:border-primary`, `pointer-events-none`). REMOVE the old bottom-right arc.
- **Resize gesture (native window listeners, as established)**:
  - On pointer down: capture `startRight` / `startBottom` from `rootRef` rect (the FIXED anchor corner), plus content minimums (`minW`/`minH` measured from the inner content ref via `offsetWidth/Height` + padding, fallback ~140×44).
  - On move: `w = clamp(startRight - clientX, minW, startRight - 8)`, `h = clamp(startBottom - clientY, minH, startBottom - 8)`; live-preview imperatively (`pillRef.current.style.width/height = px`); badge shows `${Math.round(w)}×${Math.round(h)}` px (replaces the % badge).
  - On release: clear preview and persist `setWidgetSize(w, h)`.
  - Double-click on the handle → `setWidgetSize(null, null)` (auto).
- Content: the inner row (`py/pl/pr` values kept) centered when the box is larger (`justify-center` on the pill as needed).
- Window `resize` effect: re-clamp a persisted size that exceeds the viewport (`w > innerWidth − 16` → `setWidgetSize(innerWidth − 16, h)`, same for height).
- Keep: focus logic, X = close + pause, paused tiers, gating with the user's `floatedKind` (untouched), move gesture (grip), countdown alert, sanitized finites.

**C. `FullscreenClock.tsx` — exit pauses**
- `requestClose`: before `onClose()`, pause the running timer (`stopwatch.running → stopwatchPause()`; else `countdown.running → countdownPause()`). Single exit owner covers X, Escape and any other path.

### Excludes

- i18n additions (no new keys; `time.resize` reused).
- Other widget behaviors.

## Deliverables

- [ ] `widgetSize` storage + setter + migration
- [ ] Crop-style TL handle with edges following the pointer (BR anchored), px badge, auto reset
- [ ] Undistorted content in a sized `rounded-3xl` window; no `scale()` anywhere
- [ ] Fullscreen exit pauses the running timer

## Acceptance Criteria

- [ ] Dragging the TL handle: the TL corner follows the pointer; right/bottom edges stay FIXED; wide+tall (square) possible; clamped to screen (8px margins) and content minimum
- [ ] Content (time/buttons) keeps its natural size while the box grows (no distortion)
- [ ] Size persists across reloads; double-click → back to automatic
- [ ] Move (grip) still works; pill X still closes + pauses
- [ ] Exiting fullscreen (X or Escape) pauses the running timer (value kept)
- [ ] `npm run type-check` + `build` green; live puppeteer verification

## Notes

- One-time reset of any previously saved widget size is accepted (storage semantics changed from scale factors to px dimensions).

## Completion Evidence (2026-10-19)

- Implemented: `widgetSize {w,h|null}` px storage (+legacy migration in `normalizeTimeTools`), `setWidgetSize`; TimeWidget rewritten to a translate-only root with a sized `rounded-3xl` window (no `scale()`, content undistorted/centered); TL crop handle (L-bracket) with a BR-anchored 1:1 gesture (grab-offset compensated), content minimums, 8px viewport margins, live px badge, persist-on-release, double-click auto size, window-resize re-clamp; `FullscreenClock.requestClose` pauses the running timer before closing.
- Live verification (headless Chrome, 390×720):
  - Fullscreen exit (X) → stopwatch frozen at 00:00:02 with "Resume"
  - TL drag −80/−50 → box 210×38 → 290×88 with **right/bottom edges fixed (310/648)**; root transform `translate` only; time font 14px unchanged (no distortion); badge "290×88 px" mid-drag
  - Shrink clamps at 218×44 (content minimum); double-click restores 210×38
  - Grip move still works (`translate(60px, 0px)`); pill X closes + pauses (00:00:07 frozen)
  - Custom size 270×58 persists into a fresh page (same context)
- `type-check` + `build` green.

## Follow-up (2026-10-19, post-commit `6357a61`)

- User moved the handle back to the BR corner (TL fixed) and had a time-only font bump; requested: resize must also scale **bigger numbers and everything** and the window, and the grabbed corner must follow the pointer.
- Implemented on top of the user's code:
  - **Uniform content zoom**: the whole content row (time, icon, buttons) scales by `min(ratioW, ratioH)` (bounded by the tighter axis → never overflows); measured from the CONTENT's natural layout size (immune to the drag preview — fixes the baseline-pollution bug that reverted the zoom to 1× on release).
  - **Grab-follows gesture**: the BR corner now moves with the pointer while the TL stays fixed (offset adjustment during resize: `offset = startOffset − sizeGrowth`), persisted with the size (`setWidgetSize` + `setWidgetOffset`); double-click resets size AND position.
- Live-verified: drag +80/+60 → window 210×38 → 282×98; **TL fixed (100/610), grabbed corner followed (right 382, bottom 708)**; content zoom 1.31× (time 62×14 → 81×18, buttons 32 → 42); reset restores default pose; size+position+zoom persist on a fresh page; grip move works. `type-check` + `build` green.
