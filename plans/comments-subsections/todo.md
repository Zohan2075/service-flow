---
type: planning
entity: todo
plan: "comments-subsections"
updated: "2026-08-20"
---

# Todo: comments-subsections

> Tracking [comments-subsections](plan.md)

## Active Phase: 1 - Subsection model + nested Comments UI

### Phase Context

- **Scope**: [Phase 1](phases/phase-1.md)
- **Implementation**: [Phase 1 Plan](implementation/phase-1-impl.md)
- **Latest Handover**: (none yet)
- **Relevant Docs**: `web/src/types/comments.ts`, `web/src/components/comments/CommentsView.tsx`, `web/src/lib/store.ts` (migrateCommentsConfig)

### Pending

### In Progress

### Completed

- [x] Add `parentCategoryId` to `CommentCategory` + migration pass-through <!-- completed: 2026-08-20 -->
- [x] Orphaned-box filter in `migrateCommentsConfig` (both shapes) <!-- completed: 2026-08-20 -->
- [x] `BoxCard` extraction (module-level, focus-safe) shared by root + subsection grids <!-- completed: 2026-08-20 -->
- [x] Nested rendering + subsection CRUD (add/rename/add-box/cascade-delete) <!-- completed: 2026-08-20 -->
- [x] Collapse/expand per root category + aggregated root totals <!-- completed: 2026-08-20 -->
- [x] EN/ES labels for all new strings <!-- completed: 2026-08-20 -->
- [x] Type-check + build pass <!-- completed: 2026-08-20 -->

### Blocked

## Changelog

### 2026-08-20

- Plan created (single phase)
- Phase 1 implemented and verified (type-check + build pass); changes in working tree pending commit
- Follow-up fixes: (1) header buttons icon-only on mobile (`hidden sm:inline` labels) + truncating names + shrink-protected counts so all actions fit on narrow screens; (2) auto-add now fires only when the stopped box is the most recent box of its category — re-timing an older box never inserts a new one (6 simulated scenarios pass)