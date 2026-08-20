---
type: planning
entity: todo
plan: "jw-wol-weekly-readings"
updated: "2026-08-20"
---

# Todo: jw-wol-weekly-readings

> Tracking [jw-wol-weekly-readings](plan.md)

## Active Phase: 3 - UI display & page trigger

### Phase Context

- **Scope**: [Phase 3](phases/phase-3.md)
- **Implementation**: [Phase 3 Plan](implementation/phase-3-impl.md)
- **Latest Handover**: (none yet)
- **Relevant Docs**: `web/src/app/api/jw-workbook/route.ts`, `web/src/lib/jwWorkbook.ts`, `web/src/lib/store.ts`, `web/src/types/presiding.ts`, `web/src/lib/supabase.ts`, `sql/019_program_week_reading_es.sql`

### Pending

### In Progress

### Completed

- [x] API route + parsers (month index EN/ES, weekly reading EN/ES) <!-- completed: 2026-08-20 -->
- [x] Week→month resolution + 24h TTL cache + error mapping (400/404/502) <!-- completed: 2026-08-20 -->
- [x] Verified against live WOL: W34/W35/W36/W38 readings + cache hit + invalid week <!-- completed: 2026-08-20 -->
- [x] `bibleReadingEs` on `ProgramWeek` + `ProgramWeekCatalogEntry`; static catalog W32–W34 ES values <!-- completed: 2026-08-20 -->
- [x] `normalizeWeek` + construction sites carry `bibleReadingEs` <!-- completed: 2026-08-20 -->
- [x] `refreshProgramWeekReadings` store action (skip populated, merge on success, no-op on failure) <!-- completed: 2026-08-20 -->
- [x] `pushProgram`/`pullProgram` round-trip `bible_reading_es` <!-- completed: 2026-08-20 -->
- [x] `sql/019_program_week_reading_es.sql` (idempotent column add) <!-- completed: 2026-08-20 -->
- [x] Language-aware display in ProgramView (ES fallback to EN) <!-- completed: 2026-08-20 -->
- [x] Page mount trigger `refreshProgramWeekReadings()` when online <!-- completed: 2026-08-20 -->
- [x] `npm run type-check` + `npm run build` pass <!-- completed: 2026-08-20 -->
- [x] End-to-end pipeline check (parser → store merge shape) against live WOL <!-- completed: 2026-08-20 -->

### Blocked

## Changelog

### 2026-08-20

- Plan created with 3 phases (API fetch/parse, data model+sync, UI display)
- All 3 phases implemented, verified, and committed (`8eb904f`)