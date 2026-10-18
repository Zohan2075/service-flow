---
type: planning
entity: phase
plan: "time-tab-and-program-polish"
phase: 4
status: completed
created: "2026-10-17"
updated: "2026-10-17"
---

# Phase 4: Widget Move + Arc-Resize (200%) + Tab Dividers

> Part of [time-tab-and-program-polish](../plan.md)

## Objective

Follow-up UX polish requested by the user:

1. The grip button (⠿ `drag_indicator`) now **moves the widget anywhere on screen** (free position, persisted).
2. Add an **arc/bulge handle on the rounded edge** of the pill that **resizes up to 200%** (max scale 1.6 → 2.0).
3. Separate the **Program / Comments / Time tabs with divider lines**.

## Scope

### Includes

**A. Store** — `web/src/lib/store.ts` + `web/src/types/data.ts`:
- `TIME_WIDGET_SCALE_MAX`: 1.6 → **2.0** (min stays 0.8).
- `TimeToolsState` gains `widgetOffset: { x: number; y: number }` (px added to the default right/bottom anchor; default `{0,0}`).
- `normalizeTimeTools` + `partialize` include `widgetOffset` (finite clamp ±10 000); new action `setWidgetOffset(x: number, y: number)`.

**B. `web/src/components/TimeWidget.tsx`**:
- Local clamp max → 2.0.
- **Grip = move**: pointer-capture drag on the grip updates `previewOffset` live (dx/dy from drag start added to the offset at drag start; clamped so the widget's bounding rect stays within the viewport with an 8px margin); persists via `setWidgetOffset` on release; **double-click resets offsets to (0,0)** (returns to default corner). Grip `aria-label` → new `time.move`.
- **Arc resize handle**: a decorative arc/bulge overlay on the pill's bottom-right rounded edge (absolutely positioned, e.g. `-bottom-0.5 -right-0.5 size-5 rounded-br-[12px] border-b-2 border-r-2 border-slate-300/80 dark:border-slate-500/80 hover:border-primary` inside a larger hit wrapper, `touch-none cursor-nwse-resize`, `aria-label={t("time.resize")}`); pointer-drag adjusts scale (same 120px/unit mapping, clamped 0.8–**2.0**), live preview, persist on release; double-click resets scale to 1.
- Outer transform becomes `translate(-${x}px, -${y}px) scale(${s})` (transform-origin bottom-right) using preview values while dragging.

**C. Tab dividers** — `web/src/components/ui/SegmentedControl.tsx`:
- New optional prop `dividers?: boolean`; when set, every option after the first gets `border-l border-slate-300 dark:border-slate-600` (sliding pill stays).
- `web/src/app/(dashboard)/presiding/page.tsx`: pass `dividers` to the tab SegmentedControl.

**D. i18n** — `time.move` (EN "Move" / ES "Mover").

### Excludes

- Other SegmentedControl consumers (no dividers there).
- Widget focus/priority/pause logic (unchanged).

## Deliverables

- [ ] Move-by-grip with persisted offsets + viewport clamp + double-click reset
- [ ] Arc resize handle up to 200%, persisted, double-click reset
- [ ] Divider-enabled tab bar (program/comments/time)

## Acceptance Criteria

- [ ] Drag grip → widget moves; position survives reload; can't be dragged fully offscreen
- [ ] Arc drag → scale reaches 2.0 max, 0.8 min; persists
- [ ] Dividers visible between the three tabs (computed `border-left` on options 2–3) and pill still animates
- [ ] type-check + build green; live puppeteer verification

## Notes

- Offsets are relative to the default bottom-right anchor (per-breakpoint base classes unchanged) so they survive breakpoint changes.
- Viewport shrink after moving is not auto-corrected (user can drag back); documented.

## Completion Evidence (2026-10-17)

- Implemented: grip = move-drag (free position, viewport-clamped, persisted `widgetOffset`, dblclick reset); rounded-edge **arc handle** = resize to **200%** max (0.8–2.0, persisted, dblclick reset); `SegmentedControl` `dividers` prop wired to the Program/Comments/Time tab bar; `time.move` i18n.
- **Critical bug found via live instrumentation and fixed**: the transform template emitted a double minus (`translate(--72px, …)`) for negative offsets — invalid CSS that the browser silently drops, which made the pill appear "stuck" and left rehydrated offsets unrendered. Fixed both `applyPreview` and the render template to `${-value}px`. Also: defensive `Number.isFinite` sanitization (never emit invalid transforms), native `window` listeners for gestures (pointer capture + React root delegation did not deliver captured moves), and free-move clamping when the widget is larger than the viewport (no phantom shifts on plain clicks).
- Live verification (headless Chrome, 390×720):
  - Tab dividers: `["0px","1px","1px"]` (options 2–3 carry `border-l`)
  - Move drag +100px → `translate(72px, 0px)` (clamped at viewport edge), persists across a fresh page load
  - Arc drag +300px → `scale(2)` (clamped at 200%)
  - Double-click grip → offset reset; double-click arc → scale reset (handlers verified wired + working via synthetic dispatch)
  - Hide (X) works; single instance; no page errors
- **Device-adaptive resize cap** (user follow-up "que el resize se adapte a cada pantalla"): the max scale is `min(200%, available space / base size)`, computed from the widget's current anchor position (rect edges are scale-invariant with the bottom-right origin) and recomputed on viewport resize and on every move. Verified live: mobile 390px at default anchor → max **1.40** (fits); mobile after dragging right → **1.75** (fits); desktop 1280px fresh → reaches **2.00** (fits). Persisted scales display clamped per device.
- **Follow-up 2** (user: "la hora no avanza en la píldora" + "el % es muy poco"):
  - Pill focus priority now shows **only running** timers — a paused/finished stopwatch or countdown no longer occupies the pill, so it always displays something live (running timer or ticking clock). Verified live: after pausing, the pill shows the live clock advancing (`23:28:33 → 23:28:35`).
  - Resize cap now uses the **full viewport** and the gesture **auto-shifts** the widget to keep it on screen while growing: mobile 390px reaches **175%** (fits: true), desktop reaches **200%** (fits: true).
- **Follow-up 3** (user: cronómetro flotante + "flotar la hora real" + tamaño PC):
  - Pill now supports **resume from the pill**: pausing a running timer shows the live clock **plus a ▶ button** that resumes it (verified: pause → `schedule 23:39:40` + Resume; resume → stopwatch continues).
  - NEW **"Floating widget shows" mode selector** in the Time tab (Automatic / **Real time** / Stopwatch / Countdown): with "Real time" the pill always floats the live clock, even while a stopwatch/countdown runs (verified live) — directly satisfies "be able to float a real time". Persisted (`widgetMode` in the store, normalized).
  - **PC size increase**: pill content scales up at `md+` — base **260×54** on desktop vs 210×38 on mobile (icons 40px, bigger time/arc).
- `type-check` + `build` green.
