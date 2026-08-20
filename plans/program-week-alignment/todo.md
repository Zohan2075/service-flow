---
type: planning
entity: todo
plan: "program-week-alignment"
updated: "2026-08-20"
---

# Todo: program-week-alignment

> Tracking [program-week-alignment](plan.md)

## Active Phase: 3 - ProgramView week scoping & JW-aligned New Week

### Phase Context

- **Scope**: [Phase 3](phases/phase-3.md)
- **Implementation**: [Phase 3 Plan](implementation/phase-3-impl.md)
- **Latest Handover**: (none yet)
- **Relevant Docs**: `web/src/components/presiding/ProgramView.tsx`, `web/src/lib/store.ts`, `web/src/types/presiding.ts`, `web/src/app/(dashboard)/presiding/page.tsx`

### Pending

### In Progress

### Completed

- [x] Add ISO-week → Monday computation + EN/ES range formatting in `types/presiding.ts` <!-- completed: 2026-08-20 -->
- [x] Extend `getJwWolWeekCatalogEntry` with generated fallback <!-- completed: 2026-08-20 -->
- [x] Add `getProgramWeekIdOffset` + `PROGRAM_WEEKS_AHEAD` constant <!-- completed: 2026-08-20 -->
- [x] Update `getDefaultPresidingConfig()` to seed current + 4 future weeks <!-- completed: 2026-08-20 -->
- [x] Type-check passes <!-- completed: 2026-08-20 -->
- [x] Rewrite `ensureActiveProgramWeek` (seed current+4, keep future selection, clear stale session) <!-- completed: 2026-08-20 -->
- [x] Week-scope `addPresidingLogEntry` (fresh session per active week) <!-- completed: 2026-08-20 -->
- [x] Fix `importData` session selection (current week's session, not last array element) <!-- completed: 2026-08-20 -->
- [x] Align `migratePresidingConfig` roll path (seed future + keep future selection) <!-- completed: 2026-08-20 -->
- [x] Page derives week-scoped `sessionLog` <!-- completed: 2026-08-20 -->
- [x] Session Review filtered by active week <!-- completed: 2026-08-20 -->
- [x] JW-aligned "New Week" (next ISO week + generated ranges) <!-- completed: 2026-08-20 -->
- [x] `npm run type-check` + `npm run build` pass <!-- completed: 2026-08-20 -->
- [x] Behavioral checks: catalog generation, store rollover/seeding, idempotency <!-- completed: 2026-08-20 -->

### Blocked

## Changelog

### 2026-08-20

- Plan created with 3 phases (catalog generation, store week-scoping, UI scoping)
- All 3 phases executed and verified (type-check + build + behavioral simulations pass)
- Deferred to user: real JW WOL bible-reading data for future weeks (generated weeks show empty bible reading)