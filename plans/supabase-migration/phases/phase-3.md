---
type: planning
entity: phase
plan: "supabase-migration"
phase: 3
status: pending
created: "2026-06-30"
updated: "2026-06-30"
---

# Phase 3: Data Sync Migration

> Part of [supabase-migration](../plan.md)

## Objective

Create Supabase client with CRUD operations for all data types. Rewrite `SyncProvider` to push/pull from Supabase instead of Google Drive. Update Zustand store to integrate Supabase sync and remove Drive-specific fields.

## Scope

### Includes

- Create `web/src/lib/supabase.ts` — Supabase client singleton + CRUD functions:
  - `upsertProfile(profile)` / `getProfile()`
  - `upsertSettings(settings)` / `getSettings()`
  - `upsertServiceTypes(list)` / `getServiceTypes()`
  - `upsertTimeEntries(list)` / `getTimeEntries()`
  - `upsertGoals(list)` / `getGoals()`
  - `upsertInterestedPeople(list)` / `getInterestedPeople()`
  - `pullAll()` → all data for a user
  - `pushAll(state)` → push entire state (used for sync)
  - `getLastModified()` → timestamps for sync comparison
- Rewrite `web/src/lib/sync.tsx`:
  - Replace Google Drive upload/download with Supabase push/pull
  - Keep same triggers: mount (500ms delay), visibility change, 30s debounce
  - Keep same isOnline tracking
  - Keep same hasPendingChanges detection
  - `performSync` → pushes local data to Supabase
  - `autoSync` → if no pending, pulls remote changes from Supabase
  - `syncNow` → manual sync (push local, mark synced)
  - New: `sync.status` for "connected" / "error" states
- Update `web/src/lib/store.ts`:
  - Remove `serializeBackup`, `deserializeBackup` (no more JSON backup format)
  - Remove `BackupFile`-related logic
  - Remove `autoSync` and `lastSyncedAt` from `AppSettings` (or repurpose)
  - Remove `SyncMetadata` and `hasPendingChanges` (or repurpose for Supabase)
  - Add `lastPulledAt`, `lastPushedAt` fields to track sync state
  - Keep `withPendingSync` pattern for tracking unsaved changes
  - Keep `completeSync` but rename to `markSynced()`
  - Keep `importData` for JSON import/export feature
- Update settings page sync UI:
  - Show Supabase connection status instead of Drive status
  - Manual backup → push to Supabase
  - Manual restore → pull from Supabase
  - Keep JSON export/import buttons

### Excludes (deferred to later phases)

- Removing old Drive code (Phase 4)
- Real-time subscriptions
- Offline queue improvements (current IndexedDB pattern stays)

## Prerequisites

- [ ] Phase 1 complete: Supabase tables exist with RLS
- [ ] Phase 2 complete: Supabase auth works, session available
- [ ] Store and sync code are well-understood

## Deliverables

- [ ] `web/src/lib/supabase.ts` — Supabase client + CRUD functions
- [ ] `web/src/lib/sync.tsx` — rewritten for Supabase
- [ ] `web/src/lib/store.ts` — updated sync fields
- [ ] `web/src/types/data.ts` — updated AppSettings (optional field changes)
- [ ] `web/src/app/(dashboard)/settings/page.tsx` — updated sync UI

## Acceptance Criteria

- [ ] `npm run build` succeeds
- [ ] Adding a time entry → appears in IndexedDB immediately
- [ ] After 30s (debounce), time entry appears in Supabase database
- [ ] Refreshing the page → time entry loads from IndexedDB
- [ ] Opening a second browser tab → pull detects remote changes → data appears
- [ ] Offline: add entry → still in IndexedDB → go online → syncs to Supabase
- [ ] Manual backup button → confirms "Backed up to Supabase"
- [ ] Manual restore button → pulls latest from Supabase
- [ ] Settings shows "Connected to Supabase" (green) or "Offline" (amber)

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | Blocked by | Tables and RLS must be live |
| Phase 2 | Blocked by | Supabase auth session needed for RLS |
| Phase 4 | No dependency | Cleanup removes old Drive files after sync works |

## Notes

- Service types must be synced as a unit (the full list replaces the remote list). Keep the same strategy as Drive sync.
- Time entries, goals, interested people: sync the full list each time. For small data sets (< 1000 rows), full sync is simpler than incremental.
- The `services_types` table has `sort_order`, `is_active` — syncable fields.
- Keep JSON export/import as a fallback mechanism. It uses `BackupFile` format which is already comprehensive.
- `lastModified` timestamps: use `updated_at` on each row. For pull, query rows where `updated_at > lastPulledAt`.
