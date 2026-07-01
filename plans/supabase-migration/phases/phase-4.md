---
type: planning
entity: phase
plan: "supabase-migration"
phase: 4
status: pending
created: "2026-06-30"
updated: "2026-06-30"
---

# Phase 4: Cleanup & Finalization

> Part of [supabase-migration](../plan.md)

## Objective

Remove all Drive-related code, archive the backend, update i18n keys, deprecate old env vars, bump SW cache, and finalize the migration.

## Scope

### Includes

- Remove `web/src/lib/drive.ts` entirely
- Remove `web/src/components/GoogleAuthProvider.tsx` entirely
- Remove `web/src/types/google.d.ts` (GIS type declarations)
- Remove `web/src/lib/api.ts` (now empty or remove entirely)
- Archive `backend/` directory (move to `backend-legacy/` or delete)
- Update `web/src/lib/i18n.tsx`:
  - Remove all 27+ Drive-specific keys (both en and es)
  - Add Supabase-specific keys
  - Update login footnote text
  - Update offline/sync messaging
- Update `web/netlify.toml`:
  - Remove `NEXT_PUBLIC_API_URL`
  - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Update `web/.env.local`:
  - Remove `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_URL`
  - Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Update `web/.env.local.example` similarly
- Update `web/src/lib/store.ts`:
  - Remove `serializeBackup`, `deserializeBackup` (if not already done)
  - Remove `BackupFile` import
  - Remove `exported_at` usage
- Update `web/src/types/data.ts`:
  - Remove `BackupFile` interface
  - Remove `autoSync` and `lastSyncedAt` from `AppSettings`
- Bump SW cache version
- Remove Google Cloud Build trigger (manual or via gcloud)
- Update `docs/supabase-migration-inventory.md` with final state

### Excludes

- n/a

## Prerequisites

- [ ] Phase 3 complete: Supabase sync works end-to-end
- [ ] User has verified all features work with Supabase
- [ ] User has exported any important data from Drive backup

## Deliverables

- [ ] `web/src/lib/drive.ts` — deleted
- [ ] `web/src/components/GoogleAuthProvider.tsx` — deleted
- [ ] `web/src/types/google.d.ts` — deleted
- [ ] `web/src/lib/api.ts` — deleted
- [ ] `backend/` — archived to `backend-legacy/` or deleted
- [ ] `web/src/lib/i18n.tsx` — updated (no Drive keys)
- [ ] `web/netlify.toml` — updated env vars
- [ ] `web/.env.local` — updated env vars
- [ ] `web/.env.local.example` — updated
- [ ] `web/public/sw.js` — cache version bumped
- [ ] `web/src/lib/store.ts` — Drive fields removed
- [ ] `web/src/types/data.ts` — Drive types removed
- [ ] `web/src/lib/sync.tsx` — no Drive imports
- [ ] `web/src/app/(dashboard)/settings/page.tsx` — no Drive imports/UI

## Acceptance Criteria

- [ ] `npm run build` succeeds with no errors
- [ ] No file in `web/src/` imports from `@/lib/drive` or `@/components/GoogleAuthProvider`
- [ ] `grep -r "drive" web/src/lib/` returns no results (except i18n maybe)
- [ ] `grep -r "NEXT_PUBLIC_API_URL" web/` returns no results (except example file)
- [ ] `grep -r "autoSync" web/src/lib/store.ts` returns no results
- [ ] `grep -r "lastSyncedAt" web/src/lib/store.ts` returns no results (or repurposed as `lastPushedAt`)
- [ ] `grep -r "GoogleAuthProvider" web/src/` returns only in `backend-legacy/` or docs
- [ ] All existing features work: login, calendar, reports, goals, interested people, settings, service types
- [ ] Supabase sync works end-to-end

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 3 | Blocked by | Sync must be verified working before removing Drive |
| Phase 2 | Blocked by | New auth must be stable before deleting old auth provider |

## Notes

- Don't delete the `backend/` directory — archive it as `backend-legacy/` so the code is available for reference.
- Delete the Cloud Build trigger manually or keep it (it won't trigger since we're removing the backend).
- The SW cache bump ensures users get the new Supabase-based code.
- If the user wants to keep the backend for other purposes, skip that part.
