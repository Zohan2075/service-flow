---
type: planning
entity: review
plan: "motion-and-design-polish"
date: "2026-09-30"
scope: "Full change set (Phases 1–3 + Phase 4 fixes)"
verdict: "Approve with minor changes — all findings resolved"
---

# Implementation Review — Motion & Design Polish

## Verdict

Independent review (review-implementation focus). **Approve with minor changes. No High findings.** Guardrails verified intact: calendar swipe carousel, dnd-kit sortable roots (settings + CommentsView), timers, `?tab=` URL sync, AddEntryModal cap checks, form semantics, reduced-motion coverage, focus rings.

## Findings & resolution

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Medium | `template.tsx` + login card server-rendered `opacity:0` until hydration (whole page blank on cold load) | Fixed: CSS `motion-safe:animate-slide-up` — SSR paints visible, reduced-motion respected, replays on route remount |
| 2 | Medium | `SegmentedControl` pill `bg-surface` invisible in dark mode when surface preset = `#1e293b` | Fixed: pill gained `dark:bg-slate-700` (matches previous tab-bar pattern) |
| 3 | Low | Dead `active:scale-95` / `transition-all` on AddEntryModal submit | Fixed: `transition-opacity`, `whileTap` handles transform |
| 4 | Low | Plan-mode Switch missing accessible name | Fixed: `ariaLabel={t("entry.planMode")}` |
| 5 | Low | Program-enabled settings row lost full-row click | Intentional (user-approved tradeoff): static row + `Switch`; documented in Phase 2 notes |
| 6 | Low | `PressableCard` unused | Kept as reusable primitive (documented) |
| 7 | Low | `fade-in`/`scale-in` keyframes unused | Kept as design-token fallbacks; `slide-up` now used by template + login |
| 8 | Low | White check glyph invisible on light preset swatches | Fixed: `contrastTextColor()` luminance helper in `lib/utils.ts` |
| 9 | Low | `SegmentedControl` string casts + missing aria labels | Fixed: generic `<T extends string>`; 7/8 casts removed (1 restored where TS required); aria labels added where existing i18n keys |
| 10 | Low | `StaggerGroup` per-render variant allocation; 1 Hz CommentsView re-render cost | Fixed: `useMemo` variants; hydration-aware `initial` |

## Additional fix

Hydration-safe entrances: module-level `appHydrated` + `usePostHydrationFirstRender()` in `ui/motion.tsx`. Staggered lists are never SSR-hidden; entrance animations still play for client navigations and dynamic mounts.

## Verification (post-fix)

- `npm run type-check` — exit 0
- `npm run build` — exit 0 (11/11 routes)
- `npm run lint` — exit 1: **8 pre-existing errors at HEAD** (verified single-occurrence unused code predating this work: settings `signIn`/`completeSync`, modal `getStatusColor`, PresidingSettings `resetConfig`, jwWorkbook `start`, supabase `_assigneeName`, calendar `prefer-const`, reports `annualBaselineTotalsCapped`). **Zero introduced by this change set.**
- Production smoke (`next start`): `/login`, `/calendar`, `/reports`, `/presiding`, `/presiding/settings`, `/interested`, `/settings` → 200 with content

## Not verified (requires manual visual QA)

Dark/custom surface appearance, reduced-motion runtime feel, 375px layouts, animation timing, `layoutId` slide across breakpoints.
