---
type: planning
entity: implementation-plan
plan: "program-auto-interventions"
phase: 2
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 2 - Store auto-apply + page wiring

> Implements [Phase 2](../phases/phase-2.md) of [program-auto-interventions](../plan.md)

## Approach

Extend the store's workbook refresh action so each week gets both readings AND the real program applied, governed by a strict safety rule. Reuse `setPresidingConfig` for normalization/tombstones/pending sync.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/types/presiding.ts` | modify | Add `sourceWolDocid?: string` to `ProgramWeek` |
| `web/src/lib/store.ts` | modify | Extend `refreshProgramWeekReadings` (rename to `refreshProgramFromWorkbook`) + `normalizeWeek` passthrough |
| `web/src/app/(dashboard)/presiding/page.tsx` | modify | Point effect at the renamed action |

## Required Context

| File | Why |
|------|-----|
| `web/src/lib/store.ts` (~1461) | Current `refreshProgramWeekReadings` action |
| `web/src/lib/store.ts` (~448) | `normalizeWeek` passthrough target |
| `web/src/lib/store.ts` | `setPresidingConfig` (~1426, normalization + tombstones), `submitting` template (`getDefaultPresidingConfig().weeks[0].sections`) |
| `web/src/types/presiding.ts` | `PresidingSection`, `buildS38Sections` precedent, `getDefaultTimerRoles` |
| `web/src/app/(dashboard)/presiding/page.tsx` (~74-90) | Existing effect call |

## Implementation Steps

### Step 1: Types — `sourceWolDocid`

- **What**: Add `sourceWolDocid?: string` to `ProgramWeek`; in `normalizeWeek` add passthrough (`sourceWolDocid: typeof week.sourceWolDocid === "string" ? week.sourceWolDocid : undefined`). Local-only marker (no DB column).
- **Where**: `web/src/types/presiding.ts` + store `normalizeWeek`.

### Step 2: Rename + extend the store refresh action

- **What**: Rename `refreshProgramWeekReadings` → `refreshProgramFromWorkbook` in the interface + actions + page. Behavior per week within the loop:
  1. Fetch `/api/jw-workbook?weekId=...` once (same endpoint; payload now carries programEn/programEs).
  2. Always apply readings (existing merge rule).
  3. Program apply eligibility: `programEn.length > 0` AND no `assigneeName` anywhere in the week's sections AND no sessions with logs for `weekId` (check `s.presidingSessions`) AND (`week.sourceWolDocid` already set OR the week's sections match a pristine template — compare flat section ids against `buildS38Sections()` ids via a helper). Otherwise readings-only.
  4. Build replacement sections (deterministic ids, EN titles, ES titles zipped by order when lengths match).
  5. Update the week object's `sections` + `sourceWolDocid` + `updatedAt: now()`.
  6. If anything changed, call `get().setPresidingConfig(nextConfig)` ONCE after the loop (single write, correct tombstones + pending-sync), else no-op.
- **Where**: `web/src/lib/store.ts`.
- **Why**: Core behavior; `setPresidingConfig` handles schedule offsets/tombstones/pending-sync.
- **Considerations**: The action must remain try/catch-wrapped (never throw). Skip weeks when fetch fails. Do NOT apply program when the WOL payload lacks a program (empty arrays) — keep template.

### Step 3: Build `PresidingSection` tree from workbook parts

- **What**: In the store (or an exported helper in `types/presiding.ts`, e.g., `buildWorkbookSections(weekId, programEn, programEs)`) create:
  - opening standalone: `{ id: `${weekId}-open`, group: null, ... }`.
  - each group: parent section (id `weekId-treasures|field|living`, duration = sum of parts) with `subsections` per part (`${weekId}-t${i}` / `-f${i}` / `-l${i}`).
  - concluding standalone (`${weekId}-concl`).
  - `timerRoles` via `getDefaultTimerRoles({ id, titleEn, titleEs, group })` (existing rules handle Bible-reading/fieldMinistry).
  - `schedule` (`scheduledStartMinute/EndMinute`) — leave undefined, `migratePresidingConfig.normalizeSections` computes them on apply.
- **Considerations**: Titles from the endpoint collapse whitespace; strip numbering already done server-side.

### Step 4: Update page reference

- **What**: `page.tsx` selector `refreshProgramWeekReadings` → `refreshProgramFromWorkbook` (same effect, onLine same guard).
- **Where**: `web/src/app/(dashboard)/presiding/page.tsx` lines 47 + 76 + 79 + the 60s interval block.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (store sim) | Pristine seeded week gets replaced (ids/structure/durations) | Sections reflect workbook; template ids gone |
| Unit | Week with any assignee OR logs untouched | Sections unchanged; readings still fetched |
| Unit | Idempotence: second refresh with same payload | No pending-sync spam (no changes detected) |
| Manual UI | Programa shows the real weekly parts | Matches workbook |
| Compile | `npm run type-check`, `npm run build` | Pass |

### Test Integrity Constraints

- No existing tests; `setPresidingConfig`/`ensureActiveProgramWeek` behavior not weakened.

## Rollback Strategy

- Revert store/page/types diffs; template weeks resume pristine behavior post-revert since docid is local-only.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Replace condition strictness | docid only / pristine-or-docid + no-customization | pristine-or-docid AND no assignees AND no logs | Protects all user work while allowing workbook updates |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/lib/store.ts` | `refreshProgramWeekReadings` (~1461-1501) | Action to extend |
| `web/src/lib/store.ts` | `normalizeWeek` (~450), `setPresidingConfig` (~1426) | Passthrough + single-write path |
| `web/src/types/presiding.ts` | `getDefaultTimerRoles`, `buildS38Sections` | Role/shape precedents |

### Mismatches / Notes

- `bibleReadingEs` already implemented; don't regress.
- The readings action currently skips weeks with both readings present — after extension, program-eligible weeks must not be skipped (per Phase 2 note).