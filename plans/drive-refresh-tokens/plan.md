---
type: planning
entity: plan
plan: "drive-refresh-tokens"
status: draft
created: "2026-06-22"
updated: "2026-06-22"
---

# Plan: drive-refresh-tokens

## Objective

Enable persistent Google Drive auto-sync without repeated popups by storing a Google OAuth **refresh token** on a backend server. The backend uses the refresh token to mint fresh access tokens on demand, eliminating the 1-hour token expiry problem that breaks client-side-only auto-sync on mobile PWAs.

## Motivation

The current architecture uses Google Identity Services (GIS) **token model** (`initTokenClient`), which returns short-lived access tokens (1 hour expiry) with no refresh token. On mobile PWAs, silent refresh via `prompt: "none"` is unreliable (third-party cookie blocking, iframe restrictions). This means auto-sync stops working ~1 hour after sign-in, and the user must re-authorize via a popup to resume syncing — a poor UX that the user explicitly rejected.

A FastAPI backend with Supabase PostgreSQL already exists (unused by the frontend) and has `google-auth-oauthlib` in its dependencies. By switching to the GIS **code model** and exchanging the auth code server-side, we get a long-lived refresh token that enables indefinite silent auto-sync.

## Requirements

### Functional

- [ ] Backend stores a Google OAuth refresh token per user (encrypted at rest in Supabase)
- [ ] Backend endpoint `POST /api/v1/drive/exchange` accepts an auth code, exchanges it for access + refresh tokens, stores the refresh token, returns a backend JWT
- [ ] Backend endpoint `GET /api/v1/drive/token` accepts a backend JWT, uses the stored refresh token to return a fresh Google access token
- [ ] Frontend uses GIS code model (`initCodeClient`) for sign-in — one-time popup with consent
- [ ] Frontend stores the backend JWT and uses it for all subsequent token requests
- [ ] Auto-sync calls `GET /api/v1/drive/token` to get a fresh access token — no popup, no GIS iframe
- [ ] Manual "Backup to Drive" in Settings uses the same backend token path
- [ ] Existing users (signed in via old token model) can migrate by re-authorizing once

### Non-Functional

- [ ] No popups after initial authorization — ever
- [ ] Refresh token stored securely (never exposed to the frontend)
- [ ] Backend deployed and accessible via HTTPS
- [ ] Token refresh completes in < 2 seconds
- [ ] No new frontend dependencies (use fetch, not Supabase JS SDK)

## Scope

### In Scope

- Backend: `GoogleToken` model + Alembic migration
- Backend: `/drive/exchange` and `/drive/token` endpoints using `google-auth-oauthlib`
- Frontend: Switch from `initTokenClient` to `initCodeClient` in `GoogleAuthProvider`
- Frontend: New API client (`lib/api.ts`) for backend communication
- Frontend: Updated `getSilentToken` to call backend instead of GIS
- Deployment: Backend hosting setup + Google Cloud Console configuration
- Environment: `NEXT_PUBLIC_API_URL` added to frontend env

### Out of Scope

- Migrating local data storage from IndexedDB to Supabase (data stays local)
- Moving service types / time entries / goals to the backend (they remain in IndexedDB)
- Multi-user support or sharing
- Backend-based user management UI
- Offline-first sync conflict resolution

## Definition of Done

- [ ] Backend deployed and accessible via HTTPS URL
- [ ] `POST /api/v1/drive/exchange` successfully exchanges an auth code for tokens and stores the refresh token
- [ ] `GET /api/v1/drive/token` returns a fresh access token using the stored refresh token
- [ ] Frontend sign-in uses code model with one-time popup, then stores backend JWT
- [ ] Auto-sync works without any popup after initial sign-in
- [ ] Auto-sync survives app restarts and token expiry (refresh token used server-side)
- [ ] Manual "Backup to Drive" and "Restore from Drive" work via the new token path
- [ ] Existing users can re-authorize once and then benefit from persistent auto-sync
- [ ] Lint + type-check pass on frontend; backend starts without errors

## Testing Strategy

- [ ] Backend: manual test via `/docs` Swagger UI — exchange a real auth code, verify token endpoint
- [ ] Frontend: sign in fresh → verify one-time popup → verify auto-sync runs after 30s debounce
- [ ] Frontend: close and reopen PWA → verify auto-sync runs on open without popup
- [ ] Frontend: wait > 1 hour → verify auto-sync still works (refresh token mints new access token)
- [ ] Frontend: toggle auto-sync off → verify no sync attempts
- [ ] Frontend: manual "Backup to Drive" in Settings → works via backend token path

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Backend — Drive token endpoints | [Detail](phases/phase-1.md) | pending |
| 2 | Frontend — Code model + backend integration | [Detail](phases/phase-2.md) | pending |
| 3 | Deploy + configure + end-to-end test | [Detail](phases/phase-3.md) | pending |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Google OAuth client must be configured for code model (redirect URI `postmessage`) | Sign-in fails if misconfigured | Phase 3 includes Google Cloud Console setup steps |
| Backend deployment platform choice | Affects deploy instructions | Recommend Render.com (free tier, Python support, easy GitHub deploy) |
| Refresh token may be revoked by user (Google account security) | Auto-sync stops silently | Backend returns 401 → frontend prompts for re-authorization on next manual action |
| Existing users need to re-authorize once | One-time friction | Acceptable per user decision; app detects missing backend JWT and prompts |
| Client secret in backend env | Security risk if leaked | Stored in backend `.env` only, never in frontend; Supabase secrets management |
| `redirect_uri: "postmessage"` may require Google Cloud Console configuration | Token exchange fails | Documented in Phase 3 setup steps |

## Changelog

### 2026-06-22

- Plan created
