---
type: planning
entity: plan
plan: "comments-subsections"
status: completed
created: "2026-08-20"
updated: "2026-08-20"
---

# Plan: comments-subsections

## Objective

Improve the Comments (Comentarios) timer-book interactivity by supporting **subsections** — nested groups inside a top-level category — so users can add more organizational sections and structure comment timers hierarchically (Category → Subsection → Comment boxes), mirroring the Program view's section/subsection pattern.

## Motivation

The user asked (in Spanish) to improve the Comments section's interactivity so more sections can be added and subsections are supported. Today the model is flat: categories hold comment boxes directly. With many comments per meeting, a single flat grid per category becomes unwieldy. Subsections let users group commenters (e.g., by paragraph, by group, or by topic) inside a category.

## Requirements

### Functional

- [ ] A category can contain subsections (one level deep, like the Program view's section→subsection pattern).
- [ ] Each category header offers an "add subsection" affordance.
- [ ] Each subsection has its own header: name (inline-editable), box count + accumulated total, "Add" box button, delete button.
- [ ] Comment boxes belong to a category OR a subsection; rendering groups them under their owner.
- [ ] Root category totals aggregate its own boxes plus all descendant subsection boxes.
- [ ] Deleting a root category cascades to its subsections and their boxes (with confirm).
- [ ] Deleting a subsection removes its boxes only.
- [ ] Categories can be collapsed/expanded (interactivity improvement); collapsed state persists for the session.
- [ ] Existing flat configs keep working (no parentCategoryId → top-level, boxes unaffected).

### Non-Functional

- [ ] No DB migration needed (comments config syncs as a JSON blob via `comments_config.config_json`).
- [ ] EN + ES labels for all new UI strings.
- [ ] Type-check and build pass.

## Scope

### In Scope

- `web/src/types/comments.ts` — add `parentCategoryId?: string` to `CommentCategory`.
- `web/src/lib/store.ts` — `migrateCommentsConfig` passes `parentCategoryId` through.
- `web/src/components/comments/CommentsView.tsx` — nested rendering, subsection CRUD, collapse/expand, totals aggregation, i18n.

### Out of Scope

- Drag-and-drop reordering of categories/subsections/boxes.
- Nesting deeper than one level.
- Changes to timer run/stop semantics (auto-add box, single running timer).

## Definition of Done

- [ ] Adding a subsection via a category header works; it renders nested with its own header and grid.
- [ ] Boxes can be added to a subsection and time independently; totals aggregate correctly at both levels.
- [ ] Deleting a subsection or a root category (cascade) works with confirmation.
- [ ] Collapse/expand works per category.
- [ ] Existing persisted configs render unchanged (backward compatible).
- [ ] `npm run type-check` and `npm run build` pass.

## Testing Strategy

- [ ] Manual UI pass: add subsection, add boxes to it, verify totals, delete subsection, delete root with cascade, collapse/expand.
- [ ] Type-check + build.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Subsection model + nested Comments UI | [Detail](phases/phase-1.md) | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Orphaned boxes (categoryId points to deleted subsection) | Ghost boxes | Cascade deletes remove descendant boxes; migrate guard filters boxes whose category no longer exists |
| Subsection of a subsection requested later | Model change | One level now (matches Program view); parentCategoryId design allows extension |
| Collapse state lost on reload | Minor UX | Acceptable (session-scoped); could persist later |

## Changelog

### 2026-08-20

- Plan created