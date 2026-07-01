---
type: planning
entity: phase
plan: "supabase-migration"
phase: 2
status: pending
created: "2026-06-30"
updated: "2026-06-30"
---

# Phase 2: Frontend Auth Replacement

> Part of [supabase-migration](../plan.md)

## Objective

Replace Google Identity Services (GIS) authentication with Supabase Auth (Google OAuth). Create `SupabaseAuthProvider` that provides session, user profile, sign-in, and sign-out. Update all auth consumers.

## Scope

### Includes

- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create `SupabaseAuthProvider.tsx` — React Context with:
  - `session`, `user` (Supabase User), `profile` (UserProfile from app table)
  - `signIn()` — `supabase.auth.signInWithOAuth({ provider: 'google' })`
  - `signOut()` — `supabase.auth.signOut()`
  - Session persistence via Supabase (cookies/localStorage handled by SDK)
  - Profile read from `profiles` table on session change
- Update `Providers.tsx` — replace `GoogleAuthProvider` + `SyncBridge` with new provider
- Update `login/page.tsx` — use new auth context instead of `useGoogleAuth`
- Update `layout/Sidebar.tsx` — use new auth context for user display + sign-out
- Update `settings/page.tsx` — use new auth context for auth state
- Remove `api.ts` (Drive API calls no longer needed)
- Add `@supabase/supabase-js` to `package.json`
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
- Keep `GoogleAuthProvider.tsx` temporarily (Phase 4 removal)

### Excludes (deferred to later phases)

- Supabase data sync (Phase 3)
- Removing Drive sync code (Phase 4)
- Store changes for Drive fields (Phase 3)

## Prerequisites

- [ ] Phase 1 complete: tables exist, Google OAuth configured in Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` available

## Deliverables

- [ ] `web/src/components/SupabaseAuthProvider.tsx` — new auth context provider
- [ ] `web/src/components/SupabaseAuthProvider.tsx` — `useSupabaseAuth()` hook
- [ ] `web/src/components/Providers.tsx` — updated to use SupabaseAuthProvider
- [ ] `web/src/app/login/page.tsx` — updated to use new auth
- [ ] `web/src/components/layout/Sidebar.tsx` — updated to use new auth
- [ ] `web/src/app/(dashboard)/settings/page.tsx` — updated auth references
- [ ] `web/src/lib/api.ts` — removed (or emptied of Drive functions)
- [ ] `web/package.json` — added supabase dependencies

## Acceptance Criteria

- [ ] `npm run build` succeeds
- [ ] "Continue with Google" button on login page initiates Supabase OAuth
- [ ] After Google sign-in, user is redirected back and session is active
- [ ] Sidebar shows user name and avatar from Google profile
- [ ] Sign-out clears session and returns to login page
- [ ] Refresh preserves session (no re-login needed)
- [ ] No GIS-related imports remain in auth consumers
- [ ] `useGoogleAuth` references removed from Login, Sidebar, Settings

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | Blocked by | Tables and Google OAuth must be configured |
| Phase 3 | Blocks | Data sync needs auth session for RLS |
| Phase 4 | No dependency | Cleanup removes old GoogleAuthProvider after this phase |

## Notes

- Supabase Auth's `signInWithOAuth` uses a popup or redirect flow. We'll use redirect for broader browser compatibility.
- The Supabase session is stored in a cookie (handled by `@supabase/ssr`). The anon key is public — RLS handles security.
- We need a `profiles` table (Phase 1) to store the `UserProfile` (displayName, bio, customImage). The `google_id`, `name`, `email`, `image` come from the Supabase User object.
- Keep the `UserProfile` type unchanged or add a `supabase_uid` field.
