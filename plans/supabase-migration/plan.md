---
type: planning
entity: plan
plan: "supabase-migration"
status: active
created: "2026-06-30"
updated: "2026-06-30"
---

# Plan: Supabase Migration

## Objective

Replace Google-Drive-as-database with Supabase (PostgreSQL) as the source of truth. Use Supabase Auth (Google OAuth) for login. Frontend talks to Supabase directly via `supabase-js` client with Row-Level Security. Keep IndexedDB as local-first cache with background sync to Supabase. Drop the FastAPI Cloud Run backend entirely.

## Motivation

- **Reliability**: Drive JSON-file sync is fragile — single-file conflicts, no granular updates, file search latency
- **Real-time**: Supabase supports real-time subscriptions for multi-device sync (future)
- **Simplicity**: Remove the Cloud Run backend, Cloud Build, OAuth refresh token complexity
- **Cost**: Eliminate Cloud Run costs; Supabase free tier covers this use case
- **Query capability**: SQL queries on entries, goals, interested people (reports, filtering)
- **Auth simplification**: Supabase Auth handles Google OAuth natively — no GIS code model, no backend JWT exchange

## Requirements

### Functional

- [ ] Google sign-in via Supabase Auth (NOT GIS code model)
- [ ] All data (profile, settings, serviceTypes, timeEntries, goals, interestedPeople) stored in Supabase PostgreSQL
- [ ] Local-first: writes go to IndexedDB immediately, sync to Supabase in background
- [ ] On mount, pull changes from Supabase (like auto-restore today)
- [ ] Offline support: local changes queue in IndexedDB, sync when online
- [ ] Manual backup/restore from Supabase (export JSON, import JSON)
- [ ] Multi-device sync: device A writes → Supabase → device B pulls on mount/visibility
- [ ] Remove all Google Drive API dependencies (no more Drive scopes, no more file upload/download)

### Non-Functional

- [ ] Auth UX same as today: "Continue with Google" button, session persistence
- [ ] Sync performance: 30s debounce (same as today), push/pull < 2s for typical data
- [ ] No hard dependency on network for reads (IndexedDB cache)
- [ ] RLS policies prevent cross-user data access
- [ ] Backward compatible with existing IndexedDB data (don't lose local data on upgrade)

## Scope

### In Scope

- Supabase project configuration (manual steps by user)
- SQL schema + migrations for all 6 data tables
- RLS policies for all tables
- SupabaseAuthProvider (replaces GoogleAuthProvider)
- Supabase client + CRUD operations
- Supabase-based SyncProvider (replaces Drive sync)
- Store updates (remove Drive-specific fields)
- Settings page updates (remove Drive UI, add Supabase connection status)
- Login page update (use Supabase Auth)
- Sidebar update (use Supabase session)
- i18n updates (remove Drive keys, add Supabase keys)
- Env var updates (SUPABASE_URL, SUPABASE_ANON_KEY)
- SW cache bump

### Out of Scope

- Real-time subscriptions (future phase)
- Row-level data access for multiple users per account (single user)
- Supabase Edge Functions
- Data migration from existing Drive backup to Supabase (user can manually export/import)
- Backend deployment changes (backend is being removed entirely)
- Analytics or monitoring

## Definition of Done

- [ ] User can sign in with Google via Supabase Auth
- [ ] User can sign out and session is cleared
- [ ] All data persists to Supabase after each write (debounced 30s)
- [ ] On mount, data pulls from Supabase and merges with local IndexedDB
- [ ] Offline changes queue and sync when online
- [ ] Settings page shows Supabase connection status (no Drive UI)
- [ ] All existing features work: calendar, reports, goals, interested people, service types, time entries
- [ ] All existing tests pass (if any)
- [ ] `npm run build` succeeds
- [ ] FastAPI backend directory is archived/removed
- [ ] Cloud Build trigger deleted
- [ ] No Drive API calls remain in codebase

## Testing Strategy

- [ ] Manual E2E: sign in, add entries, refresh, verify data persists
- [ ] Manual E2E: two browser tabs as "two devices", verify sync
- [ ] Manual E2E: go offline, add entries, go online, verify sync
- [ ] Verify RLS: attempt cross-user access (manual, with second Google account)
- [ ] `npm run build` must pass

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Supabase Schema & Auth Setup | SQL tables, RLS, auth config, manual setup instructions | pending |
| 2 | Frontend Auth Replacement | SupabaseAuthProvider, login page, sidebar, providers | pending |
| 3 | Data Sync Migration | Supabase client, CRUD, sync provider, store updates | pending |
| 4 | Cleanup & Finalization | Remove Drive code, backend archive, i18n, env vars, SW bump | pending |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Supabase project already exists with backend tables | Tables may conflict with existing `users`, `service_types`, `time_entries` | Create new tables with `app_` prefix or drop existing backend tables (backend is being removed) |
| User's Google Cloud project may need OAuth redirect URIs configured | Login fails if not configured | Provide exact redirect URI from Supabase Auth dashboard |
| IndexedDB schema may need migration for removed Drive fields | Store hydration fails | The `merge` function in store handles missing fields gracefully; remove fields from `partialize` |
| Service worker caches old HTML | User sees stale pages after deploy | SW cache bump included in Phase 4 |
| Current users have data in Drive, not Supabase | Data loss on switch | User can manually export JSON from Settings → import JSON after Supabase is active; keep export/import JSON feature |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public | Security concern | Anon key is designed to be public; RLS policies enforce per-user access |

## Changelog

### 2026-06-30

- Plan created
