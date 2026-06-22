---
type: planning
entity: phase
plan: "drive-refresh-tokens"
phase: 2
status: pending
created: "2026-06-22"
updated: "2026-06-22"
---

# Phase 2: Frontend — Code model + backend integration

> Part of [drive-refresh-tokens](../plan.md)

## Objective

Switch the frontend from GIS token model (`initTokenClient`) to GIS code model (`initCodeClient`), integrate with the backend's token exchange/refresh endpoints, and update auto-sync to get Drive access tokens from the backend instead of GIS. After this phase, auto-sync works without any popup after the initial one-time sign-in.

## Scope

### Includes

- New `NEXT_PUBLIC_API_URL` environment variable (backend base URL)
- New API client in `web/src/lib/api.ts`:
  - `exchangeDriveCode(code: string)` → `POST /api/v1/drive/exchange`
  - `getDriveToken(jwt: string)` → `GET /api/v1/drive/token`
  - `revokeDriveToken(jwt: string)` → `DELETE /api/v1/drive/revoke`
  - Uses `fetch` (no new dependencies)
- `GoogleAuthProvider` changes:
  - Switch from `initTokenClient` to `initCodeClient` for sign-in
  - `signIn()` flow: GIS code popup → get auth code → send to backend `exchangeDriveCode` → store backend JWT in localStorage → fetch user info
  - New `getBackendJwt()` helper — reads stored backend JWT from localStorage
  - `requestDriveAccess({ interactive: false })` → calls `getDriveToken(jwt)` (backend refresh, no popup)
  - `requestDriveAccess({ interactive: true })` → tries silent first, falls back to code model popup if JWT is missing/invalid
  - `signOut()` → calls `revokeDriveToken(jwt)` then clears local state
- `Providers.tsx` `SyncBridge`:
  - `getSilentToken` calls `requestDriveAccess({ interactive: false })` (unchanged interface, now hits backend)
  - `getInteractiveToken` calls `requestDriveAccess({ interactive: true })` (unchanged interface, now uses code model)
- `Settings` page:
  - Manual "Backup to Drive" and "Restore from Drive" work via the new token path (should require no changes if `requestDriveAccess` interface is preserved)
- Migration path for existing users:
  - If `storeProfile` exists but no backend JWT in localStorage → app still works for local data
  - First manual "Backup to Drive" or sign-in triggers the new code model flow (one-time popup)
  - After that, backend JWT is stored and auto-sync works without popups

### Excludes (deferred to later phases)

- Backend deployment (Phase 3)
- Google Cloud Console configuration (Phase 3)
- Moving local data to the backend (out of scope entirely)

## Prerequisites

- [ ] Phase 1 complete — backend endpoints exist and are testable
- [ ] Backend running locally (or deployed) at a URL accessible from the frontend
- [ ] `NEXT_PUBLIC_API_URL` set in `web/.env.local`

## Deliverables

- [ ] `web/src/lib/api.ts` — backend API client with `exchangeDriveCode`, `getDriveToken`, `revokeDriveToken`
- [ ] `web/src/components/GoogleAuthProvider.tsx` — refactored to use code model + backend
- [ ] `web/src/components/Providers.tsx` — updated `SyncBridge` (minimal changes, interface preserved)
- [ ] `web/.env.local.example` — updated with `NEXT_PUBLIC_API_URL`
- [ ] `web/src/types/google.d.ts` — updated if needed for `initCodeClient` types

## Acceptance Criteria

- [ ] Fresh sign-in: one-time GIS code popup → backend JWT stored → user profile loaded
- [ ] `requestDriveAccess({ interactive: false })` returns a Google access token from the backend (no popup)
- [ ] Auto-sync runs 30s after an edit without any popup
- [ ] Close and reopen the PWA → auto-sync runs on open without popup
- [ ] Manual "Backup to Drive" in Settings works via the new token path
- [ ] Manual "Restore from Drive" in Settings works via the new token path
- [ ] Sign out clears backend JWT and revokes tokens
- [ ] Existing user with old-style sign-in can re-authorize via the new flow
- [ ] `npm run lint` + `npm run type-check` pass

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 1 | blocked-by | Needs backend endpoints to exist |
| 3 | blocks | Deployment + end-to-end testing needs frontend changes complete |

## Notes

- The `initCodeClient` API is similar to `initTokenClient` but returns an auth code instead of an access token. The callback receives `{ code: string }` instead of `{ access_token: string }`.
- The `redirect_uri` for `initCodeClient` should be `postmessage` (for the popup flow). This is a special Google value that doesn't require an actual redirect URI in Google Cloud Console (but the OAuth client should be configured as "Web application" type).
- The backend JWT (from `POST /drive/exchange`) is separate from the Google access token. The backend JWT is used to authenticate with the backend; the backend returns a Google access token which is used for Drive API calls.
- The existing `DRIVE_SESSION_STORAGE_KEY` localStorage key stored Google access tokens. With the new approach, we store the **backend JWT** instead (the Google access token is fetched on-demand from the backend and kept only in memory).
