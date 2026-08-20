---
type: planning
entity: implementation-plan
plan: "jw-wol-weekly-readings"
phase: 3
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 3 - UI display & page trigger

> Implements [Phase 3](../phases/phase-3.md) of [jw-wol-weekly-readings](../plan.md)

## Approach

Display the reading in the active language in the Program view, and trigger `refreshProgramWeekReadings()` from the presiding page alongside the existing `ensureActiveProgramWeek()` calls.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/components/presiding/ProgramView.tsx` | modify | Language-aware reading display |
| `web/src/app/(dashboard)/presiding/page.tsx` | modify | Trigger reading refresh on mount + interval |

## Required Context

| File | Why |
|------|-----|
| `web/src/components/presiding/ProgramView.tsx` | `bibleReading` computation (~line 406–409), `isEs` var |
| `web/src/app/(dashboard)/presiding/page.tsx` | `ensureActiveProgramWeek` effect (lines 62–66), store actions |

## Implementation Steps

### Step 1: Language-aware reading display

- **What**: Replace the `bibleReading` computation in `ProgramView` (currently `catalogEntry?.bibleReading ?? activeWeek?.bibleReading ?? ""`) with:
  - EN: `catalogEntry?.bibleReading ?? activeWeek?.bibleReading ?? ""`.
  - ES: `catalogEntry?.bibleReadingEs ?? activeWeek?.bibleReadingEs ?? activeWeek?.bibleReading ?? ""` (ES from week/catalog, falling back to EN reading so it's never blank).
- **Where**: `web/src/components/presiding/ProgramView.tsx` (~line 409).
- **Why**: Show the workbook reading in the active language.
- **Considerations**: Keep catalog precedence consistent with existing behavior (catalog first).

### Step 2: Trigger refresh from the presiding page

- **What**: In `page.tsx`, get `refreshProgramWeekReadings` from the store. In the mount effect (lines 62–66), after `ensureActiveProgramWeek()`, call `void refreshProgramWeekReadings()` (guard with `navigator.onLine`). Also call it after hydration completes (the same effect covers mount).
- **Where**: `web/src/app/(dashboard)/presiding/page.tsx`.
- **Why**: Seeded weeks get readings fetched once (subsequent calls skip populated weeks).
- **Considerations**: Do NOT add it to the 60s interval — the interval only re-ensures weeks; refresh happens on mount + when a new week is created (can also be invoked from `createWeek` in ProgramView if desired — but out of scope; the mount call suffices for seeded weeks, and new weeks get fetched on next mount).

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Manual UI | English UI, W34 | Shows EN reading |
| Manual UI | Spanish UI, W34 | Shows ES reading (falls back to EN if missing) |
| Manual UI | Offline load | No crash; previously fetched readings remain |
| Compile | `npm run type-check` | Passes |

### Test Integrity Constraints

- No existing tests affected.

## Rollback Strategy

- Revert the two file diffs; the store/API remain but unused.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Refresh cadence | mount only / mount + interval | mount only | Interval would spam the API; mount covers seeded weeks |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/components/presiding/ProgramView.tsx` | `bibleReading` computation (~409) | The displayed value |
| `web/src/app/(dashboard)/presiding/page.tsx` | mount effect (62–66) | Where refresh is triggered |

### Mismatches / Notes

- The catalog entry is the current source for EN; after Phase 2 the week object may carry fresher ES from the API. The ES branch prefers catalog ES, then week ES, then EN fallback.
- The page's `sessionLog`/`activeWeek` memos must not be disturbed by the new refresh call.