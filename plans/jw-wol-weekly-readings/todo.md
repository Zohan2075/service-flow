---
type: planning
entity: todo
plan: "jw-wol-weekly-readings"
updated: "2026-08-20"
---

# Todo: jw-wol-weekly-readings

> Tracking [jw-wol-weekly-readings](plan.md)

## Active Phase: 1 - WOL fetch + parse + API route

### Phase Context

- **Scope**: [Phase 1](phases/phase-1.md)
- **Implementation**: [Phase 1 Plan](implementation/phase-1-impl.md)
- **Latest Handover**: (none yet)
- **Relevant Docs**: `web/src/app/api/jw-workbook/route.ts` (new), `web/src/types/presiding.ts` (getIsoWeekMonday), WOL structure (verified live)

### Pending

- [ ] Add API route with month-index + weekly-page parsers <!-- added: 2026-08-20 -->
- [ ] Week→month resolution (year + month slug from Monday) <!-- added: 2026-08-20 -->
- [ ] In-memory TTL cache <!-- added: 2026-08-20 -->
- [ ] Error handling (400/404/502) <!-- added: 2026-08-20 -->
- [ ] Type-check + API behavior checks pass <!-- added: 2026-08-20 -->

### In Progress

### Completed

### Blocked

## Changelog

### 2026-08-20

- Plan created with 3 phases (API fetch/parse, data model+sync, UI display)