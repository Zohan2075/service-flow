---
type: planning
entity: implementation-plan
plan: "program-schedule-cascade"
phase: 1
status: draft
created: "2026-08-20"
updated: "2026-08-20"
---

# Implementation Plan: Phase 1 - Schedule helper + start/end editors + gap sync

> Implements [Phase 1](../phases/phase-1.md) of [program-schedule-cascade](../plan.md)

## Approach

1. Add gap + helper functions to `types/presiding.ts` (zero-import module → standalone-compilable harness).
2. In `ProgramView.tsx`: replace the inline cascade loop with the helper; add `start`/`end` to the inline editor union/tabs/inputs; wire edits to the helpers.
3. Sync: `gap_before_minute` column + mappings.

## Required Context

| File | Why |
|------|-----|
| `web/src/components/presiding/ProgramView.tsx` lines ~493-522 | CURRENT cascade loop to extract (`cursor`, `pushTimed`, +5/+4 rules, `cascadeEndMin` usage at footer L755) |
| `ProgramView.tsx` ~450 (inlineField state), ~845-895 (InterventionRow props/tabs/editors), ~705+~730 (call sites) | Reintroduce start/end fields |
| `web/src/types/presiding.ts` | `PresidingSection` type + new helpers |
| `web/src/lib/supabase.ts` | `flattenProgramSections` / `sectionsFromRows` / `sectionsFromLegacyJson` |
| `sql/019_program_week_reading_es.sql` | Migration conventions |

## Implementation Steps

### Step 1: Types — gap field + pure helpers (`types/presiding.ts`)

- **What**:
  - `PresidingSection` gains `/** Minutes inserted before this part (user gap on the cascading schedule). */ gapBeforeMinute?: number;`
  - `export function computeScheduleOffsets(sections: PresidingSection[]): { startOffsets: number[]; endOffsets: number[]; totalEndMinute: number }`:
    - Mirrors the current loop EXACTLY plus gaps: per top-level i: `if (s.group === "living") cursor += 4;` then `cursor += max(0, s.gapBeforeMinute ?? 0)`; if group: for each child `cursor += max(0, child.gapBeforeMinute ?? 0); push(child.duration)`; else `push(s.duration)`; after pushing: `if (i === 0) cursor += 5`.
    - `push(d)` pushes `startOffsets.push(cursor); cursor += max(0,d); endOffsets.push(cursor);`
  - `export function gapForStartEdit(section, currentStartOffset, desiredStartOffset): number` → `Math.max(0, (section.gapBeforeMinute ?? 0) + (desiredStartOffset - currentStartOffset))`.
  - `export function durationForEndEdit(currentStartOffset, desiredEndOffset): number` → `Math.max(1, desiredEndOffset - currentStartOffset)`.
- **Considerations**: NaN-safe (`Number.isFinite` guards mirror current `pushTimed`).

### Step 2: ProgramView — use the helper

- **What**: Replace the inline loop (lines ~500-522) with `const { startOffsets, endOffsets, totalEndMinute } = computeScheduleOffsets(sections);` and map to `startTimes = startOffsets.map(o => startMinTotal + o)`, `endTimes = ...`; `cascadeEndMin = startMinTotal + totalEndMinute`. Keep downstream consumers unchanged (`startTimes[flatIdx]`, `endTimes[flatIdx]`, footer `cascadeEndMin`).
- **Why**: Single source of truth for the cascade + testable.

### Step 3: ProgramView — start/end inline editors

- **What**:
  - `inlineField` union: `"title" | "assignee" | "duration" | "start" | "end" | null` (state ~L451 + prop type ~L856).
  - Field tabs: iterate `["title","assignee","duration","start","end"]` (label: start → `isEs ? "Inicio" : "Start"`; end → `lbl.end`).
  - Inputs (`type="time"`): value = 24h string built from the part's cascaded absolute time (pass new props `startAbsoluteMin`/`endAbsoluteMin` = `startMinTotal + startOffsets[flatIdx]` / `endOffsets[flatIdx]`; helper `toTimeInput(min)` = `HH:MM` modulo 24h — can reuse the existing `fmtClock(min, true)`).
  - onChange handlers (compute desired offset relative to meeting start with day-wrap `(target - meetingStartMinute + 1440) % 1440`):
    - start: `onUpdate(s => ({ ...s, gapBeforeMinute: gapForStartEdit(s, currentStartOffset, desired) || undefined }))`
    - end: `onUpdate(s => ({ ...s, duration: durationForEndEdit(currentStartOffset, desired) }))`
    - where `currentStartOffset = startAbsoluteMin - meetingStartMinute` (prop already carries `meetingStartMinute`).
  - Duration editor: unchanged (`{ ...s, duration }`).
  - Title/assignee: unchanged.
- **Considerations**: single `updateActiveWeek` write per change (no two-step clobbering). `gapBeforeMinute: 0` normalize to `undefined` to keep data clean.

### Step 4: Sync — gap column

- **What**:
  - `flattenProgramSections`: add `gap_before_minute: section.gapBeforeMinute ?? 0`.
  - `sectionsFromRows`: add `gapBeforeMinute: Number(row.gap_before_minute ?? 0) || undefined`.
  - `sectionsFromLegacyJson`: add `gapBeforeMinute: Number(item.gapBeforeMinute ?? item.gap_before_minute ?? 0) || undefined`.
  - `sql/020_program_gap_before_minute.sql`: `ALTER TABLE public.program_interventions ADD COLUMN IF NOT EXISTS gap_before_minute INT;` + `NOTIFY pgrst, 'reload schema';`.

### Step 5: Verify

- **What**: Harness (temp dir, standalone tsc of `types/presiding.ts`) asserting Step-1 formulas + baseline + gap shifts + idempotence; then `npm run type-check` + `npm run build`.

## Testing Plan

| Test | Expected |
|------|----------|
| Baseline `computeScheduleOffsets(buildS38Sections())` | starts `[0,6,16,26,29,30,34,38,46,61,91]`, ends `[1,16,26,29,30,34,38,42,61,91,94]`, total 94 |
| Gap on first living child (10) | starts `[…46→56, 61→71, 91→101]`, total 104 |
| Gap on treasures parent (3) | talk 6→9 … all downstream +3 |
| Gap on opening (2) | all +2 |
| `gapForStartEdit` trio | 4 / 0 / 6 per phase AC |
| `durationForEndEdit` | 24 / 1 |
| Recompute after helper output unchanged input | pure (no mutation) |

### Test Integrity Constraints

- ProgramView display output for gap-less sections must remain identical (baseline assertion).
- No store normalization changes.

## Rollback Strategy

- Revert types/ProgramView/supabase/migration; gap field is optional and ignored by older code.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Start-edit primitive | adjust previous durations / persist gap | persist gap | Gaps are real (songs/transitions) and already exist as built-ins |
| Gap for groups | parent field | parent field | `gapBeforeMinute` on the group's first child would blur parent semantics; parent carries it |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why |
|------|-------------|-----|
| `ProgramView.tsx` | cascade loop L496-522 (uncommitted user work) | Extract verbatim + gap |
| `ProgramView.tsx` | `inlineField` L451, InterventionRow L845-895 | Reintroduce start/end |
| `supabase.ts` | `flattenProgramSections` / `sectionsFromRows` | Sync mapping |
| `store.ts` | `normalizeSections` spread | `gapBeforeMinute` passthrough (no change) |

### Mismatches / Notes

- The user's cascade change is uncommitted — do NOT revert or reorder it; keep its behavior byte-identical for gap-less data.
- `lbl.end` already exists; add `start` label ("Start"/"Inicio").