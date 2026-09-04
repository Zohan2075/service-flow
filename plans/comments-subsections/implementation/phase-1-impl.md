---
type: planning
entity: implementation-plan
plan: "comments-subsections"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - Subsection model + nested Comments UI

> Implements [Phase 1](../phases/phase-1.md) of [comments-subsections](../plan.md)

## Approach

Introduce one-level subsections via an optional `parentCategoryId` on `CommentCategory` (flat array, no shape migration). Rework `CommentsView` to render root categories with nested subsection groups, add per-category "add subsection" and collapse/expand, cascade deletes, and aggregated totals.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/types/comments.ts` | modify | Add `parentCategoryId?: string` to `CommentCategory` |
| `web/src/lib/store.ts` | modify | `migrateCommentsConfig` (line 558) passes `parentCategoryId` through; filter orphaned boxes |
| `web/src/components/comments/CommentsView.tsx` | modify | Nested rendering, subsection CRUD, collapse, totals, i18n |

## Required Context

| File | Why |
|------|-----|
| `web/src/types/comments.ts` | Data model + factories (`createCommentCategory`, `createCommentBox`) |
| `web/src/components/comments/CommentsView.tsx` | Full current UI: category sections (lines 429–641), box grid, edit flows, i18n table `L` (lines 37–100), `boxesByCategory` memo (line 161), `removeCategory` (line 307), `addCategory` (line 294) |
| `web/src/lib/store.ts` lines 558–595 | `migrateCommentsConfig` — category normalization + orphan-box filter target |

## Implementation Steps

### Step 1: Data model — `parentCategoryId`

- **What**: Add `parentCategoryId?: string;` to `CommentCategory` (after `sortOrder`). No factory signature change required (subsections created then patched, or extend `createCommentCategory` with an optional 5th param — choose the cleaner minimal option).
- **Where**: `web/src/types/comments.ts` line 7–14.
- **Why**: Flat array + parent pointer = zero-migration nesting.

### Step 2: Store migration — pass-through + orphan guard

- **What**: In `migrateCommentsConfig` (store.ts lines 562–574) add `parentCategoryId: typeof item.parentCategoryId === "string" && item.parentCategoryId ? item.parentCategoryId : undefined` to the normalized category. After building `boxesByWeek`, filter boxes whose `categoryId` is not present in `categories` (prevents ghost boxes when a subsection was deleted on another device).
- **Where**: `web/src/lib/store.ts` lines 558–595.
- **Why**: Field must survive persistence/restore; orphans would render nowhere.

### Step 3: CommentsView — derived structure

- **What**: Add memos:
  - `rootCategories` = `sortedCategories.filter(c => !c.parentCategoryId)`.
  - `subsectionsByParent` = `Map<parentId, CommentCategory[]>` from categories with `parentCategoryId`, sorted by `sortOrder`.
  - `descendantBoxesFor(catId)` helper: root total = own boxes + sum over subsections' boxes. Keep existing `boxesByCategory` (works unchanged — boxes keep flat `categoryId`).
  - `childrenOf` guard: subsections never render their own children (one level).
- **Where**: `CommentsView.tsx` near existing memos (lines 156–169).
- **Why**: Single source for nested rendering + aggregated totals.

### Step 4: CommentsView — nested rendering

- **What**: In the category section render loop (lines 429–641):
  - Header keeps existing name edit/count/add/delete; count+total now use the aggregate (own + descendants).
  - Add an "add subsection" button to the header (icon `subdirectory_arrow_right` or `create_new_folder` + label).
  - After the root's own box grid, render each subsection: an indented header row (smaller: color dot, name-edit button, `N · total`, add, delete) and its own box grid using the same `TimerBox` card markup — extract the box card into a local component (e.g., `BoxCard`) to avoid duplicating ~120 lines; props: box, color, callbacks (toggle/reset/edit/remove/editTime), labels, isRunning.
  - Collapse/expand: chevron button on the root header toggles `collapsedIds` local state (`Set<string>`); when collapsed, hide the root's grid + subsections (header row stays).
- **Where**: `CommentsView.tsx`.
- **Why**: Core feature + interactivity.
- **Considerations**: Keep the running-timer strip and quick-add unchanged. Subsection add-box uses the same `addBox` flow (box.categoryId = subsection id). Empty subsection grids render fine.

### Step 5: CommentsView — CRUD + cascade

- **What**:
  - `addSubsection(parentId)`: create category with `parentCategoryId: parentId`, color inherited from parent (or next palette color), `sortOrder` = max sibling + 1; open inline rename.
  - `removeCategory(root)` when it has subsections: confirm text mentions subsections; delete root + its subsections + boxes belonging to any of them (extend existing loop at lines 307–324).
  - `removeSubsection(sub)`: confirm; delete subsection + its boxes (same helper with `parentCategoryId` filter).
  - Existing category rename/edit flows work for subsections (they're categories).
- **Where**: `CommentsView.tsx` (functions around lines 294–347).
- **Why**: Full lifecycle management.

### Step 6: i18n

- **What**: Add to `L.en`/`L.es`: `addSubsection` ("Add Subsection" / "Agregar Subsección"), `removeSubsection` ("Delete subsection" / "Eliminar subsección"), `removeSubsectionConfirm` ("Delete this subsection and all its comments?" / "¿Eliminar esta subsección y todos sus comentarios?"), `removeCategoryConfirm` updated to mention subsections when present ("Delete this category, its subsections and all their comments?" / "¿Eliminar esta categoría, sus subsecciones y todos sus comentarios?") — either two keys or a parameterized string; pick the simpler.
- **Where**: `CommentsView.tsx` lines 37–100.
- **Why**: Bilingual UI.

### Step 7: Verify

- **What**: `npm run type-check`; then `npm run build`.
- **Why**: Baseline verification (no test runner in repo).

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Manual UI | Add subsection from category header; rename inline | Subsection renders nested with own grid |
| Manual UI | Add box to subsection; run timer; stop (auto-add fires) | Totals aggregate at subsection + root |
| Manual UI | Delete subsection / delete root with cascade | Boxes removed; confirm text accurate |
| Manual UI | Collapse/expand root category | Grid + subsections hidden/shown |
| Manual UI | Reload with pre-existing flat config | Renders unchanged (no parents) |
| Compile | `npm run type-check`, `npm run build` | Pass |

### Test Integrity Constraints

- No existing automated tests; no behavior change to timers/sync beyond config blob passthrough.

## Rollback Strategy

- Revert the three files; config blob stays valid (extra field ignored by old code).

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Nesting depth | One level / arbitrary | One level | Matches Program view pattern; simpler UI |
| Subsection color | Inherit parent / next palette | Inherit parent | Visual grouping clarity |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/types/comments.ts` | `CommentCategory` (7–14), `createCommentCategory` (47) | Model + factory |
| `web/src/lib/store.ts` | `migrateCommentsConfig` (558–595) | Pass-through + orphan filter |
| `web/src/components/comments/CommentsView.tsx` | memos (156–169), `addCategory` (294), `removeCategory` (307), category loop (429–641), `L` (37–100) | All UI touch points |

### Mismatches / Notes

- `boxesByCategory` already keys by any category id — subsection boxes flow through unchanged.
- Comments config syncs as JSON blob; no SQL migration needed.
- The auto-add-box and single-running-timer logic operate on the flat per-week box list — untouched by nesting.