---
type: planning
entity: phase
plan: "comments-subsections"
phase: 1
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Phase 1: Subsection model + nested Comments UI

> Part of [comments-subsections](../plan.md)

## Objective

Add one-level subsections to the Comments timer book and rework `CommentsView` to render/manage them with improved interactivity (per-category "add subsection", collapsible sections, aggregated totals).

## Scope

### Includes

- `web/src/types/comments.ts`: add `parentCategoryId?: string` to `CommentCategory` (optional → backward compatible).
- `web/src/lib/store.ts`: `migrateCommentsConfig` passes `parentCategoryId` through; filter orphaned boxes whose `categoryId` no longer matches any category.
- `web/src/components/comments/CommentsView.tsx`:
  - Compute root categories (no parent) and subsections (parent set), both sorted by `sortOrder`.
  - Render each root category as today, followed by its subsections as nested sub-groups (indented headers, own box grid).
  - Boxes whose `categoryId` is a subsection render in that subsection's grid; boxes on the root render in the root's grid.
  - Per-category header: "add subsection" button; per-subsection header: edit name, count+total, add box, delete.
  - Root category total aggregates own + descendant boxes; subsection totals are their own boxes.
  - Collapse/expand per root category (chevron toggle, local state).
  - Root delete cascades to subsections + boxes (confirm text mentions subsections when present).
  - i18n EN/ES for all new strings.

### Excludes

- Drag-and-drop reordering; deeper nesting; timer semantics changes.

## Prerequisites

- [ ] None

## Deliverables

- [ ] Subsection-capable model, migration pass-through, and nested UI.

## Acceptance Criteria

- [ ] Can add a subsection from a category header; it renders nested with its own header and grid.
- [ ] Boxes in subsections time correctly; root totals include subsection boxes.
- [ ] Delete subsection removes its boxes; delete root cascades with confirm.
- [ ] Collapse/expand works per category.
- [ ] Existing configs (no parentCategoryId) render unchanged.
- [ ] `npm run type-check` passes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| — | — | Single-phase plan |

## Notes

- Comments config syncs as a JSON blob (`comments_config.config_json`), so no SQL migration is required.
- Keep the single-running-timer and auto-add-box semantics untouched.