---
type: planning
entity: todo
plan: "supabase-migration"
updated: "2026-06-30"
---

# Todo: supabase-migration

> Tracking [supabase-migration](plan.md)

## Active Phase: 1 - Supabase Schema & Auth Setup

### Phase Context

- **Scope**: [Phase 1](phases/phase-1.md)
- **Implementation**: [Phase 1 Plan](implementation/phase-1-impl.md) *(pending)*
- **Latest Handover**: *(none yet)*
- **Relevant Docs**: `docs/supabase-migration-inventory.md`, `web/src/types/data.ts`, `web/src/lib/store.ts`

### Pending

- [ ] Write `sql/001_schema.sql` — all 6 tables <!-- added: 2026-06-30 -->
- [ ] Write `sql/002_rls.sql` — RLS policies <!-- added: 2026-06-30 -->
- [ ] Write `SETUP.md` — manual setup instructions <!-- added: 2026-06-30 -->
- [ ] Update `web/.env.local` with Supabase env vars <!-- added: 2026-06-30 -->
- [ ] Update `web/.env.local.example` <!-- added: 2026-06-30 -->
- [ ] Phase 2: Auth replacement <!-- added: 2026-06-30 -->
- [ ] Phase 3: Data sync migration <!-- added: 2026-06-30 -->
- [ ] Phase 4: Cleanup & finalization <!-- added: 2026-06-30 -->

### In Progress

*(none)*

### Completed

*(none)*

### Blocked

*(none)*

## Changelog

### 2026-06-30

- Todo created
