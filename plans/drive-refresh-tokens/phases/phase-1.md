---
type: planning
entity: phase
plan: "drive-refresh-tokens"
phase: 1
status: pending
created: "2026-06-22"
updated: "2026-06-22"
---

# Phase 1: Backend — Drive token endpoints

> Part of [drive-refresh-tokens](../plan.md)

## Objective

Add Google Drive token storage and exchange endpoints to the existing FastAPI backend. The backend will exchange a Google auth code (received from the frontend's GIS code model) for access + refresh tokens, store the refresh token in Supabase, and provide an endpoint to get fresh access tokens on demand using the stored refresh token.

## Scope

### Includes

- `GoogleToken` SQLAlchemy model: stores `user_id` (FK to users), `google_refresh_token`, `google_access_token`, `access_token_expires_at`
- Alembic migration for the `google_tokens` table
- `POST /api/v1/drive/exchange` endpoint:
  - Accepts `{ code: string }` (auth code from GIS `initCodeClient`)
  - Exchanges the code using `google-auth-oauthlib` `Flow` with `redirect_uri: "postmessage"`
  - Creates or finds the user in the DB (from the Google ID token in the response)
  - Stores the refresh token (and current access token + expiry)
  - Returns `{ access_token: string, refresh_token: string }` (backend JWT tokens, NOT Google tokens)
- `GET /api/v1/drive/token` endpoint:
  - Requires backend JWT auth (`CurrentUser` dependency)
  - Uses the stored refresh token to get a fresh Google access token (via `google.oauth2.credentials.Credentials.refresh()`)
  - Updates the stored access token + expiry
  - Returns `{ access_token: string }` (Google access token for Drive API)
- `DELETE /api/v1/drive/revoke` endpoint (optional but recommended):
  - Requires backend JWT auth
  - Deletes the stored Google tokens for the user
  - Used during sign-out cleanup
- Pydantic schemas for request/response models

### Excludes (defered to later phases)

- Frontend changes (Phase 2)
- Deployment (Phase 3)
- Token encryption at rest (using Supabase's built-in encryption; refresh token stored as plain text in the DB for now — acceptable for a single-user app, can add encryption later)

## Prerequisites

- [ ] Supabase project is set up and accessible
- [ ] Backend `.env` configured with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `JWT_SECRET_KEY`
- [ ] Backend runs locally (`uvicorn app.main:app --reload`)
- [ ] `google-auth-oauthlib` is in `requirements.txt` (already present)

## Deliverables

- [ ] `backend/app/models/google_token.py` — SQLAlchemy model
- [ ] `backend/alembic/versions/xxx_add_google_tokens_table.py` — migration
- [ ] `backend/app/schemas/drive.py` — Pydantic request/response schemas
- [ ] `backend/app/services/drive.py` — token exchange + refresh logic
- [ ] `backend/app/routers/drive.py` — API endpoints
- [ ] `backend/app/main.py` — register the new router
- [ ] `backend/app/models/__init__.py` — export new model (if needed for Alembic auto-detection)

## Acceptance Criteria

- [ ] Backend starts without errors: `uvicorn app.main:app --reload`
- [ ] `POST /api/v1/drive/exchange` with a valid auth code returns backend JWT tokens
- [ ] `GET /api/v1/drive/token` with a valid backend JWT returns a Google access token
- [ ] Calling `GET /api/v1/drive/token` again after the access token expires returns a freshly refreshed token
- [ ] `DELETE /api/v1/drive/revoke` removes stored tokens
- [ ] Alembic migration applies cleanly: `alembic upgrade head`
- [ ] All endpoints visible in `/docs` Swagger UI

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 2 | blocks | Frontend integration depends on these endpoints existing |
| 3 | blocks | Deployment depends on the backend code being complete |

## Notes

- The existing `User` model and `google_auth_or_create` service handle user creation from Google ID tokens. The exchange endpoint should reuse this logic.
- The existing `CurrentUser` dependency (JWT-based) is used for authenticated endpoints.
- `google-auth-oauthlib` `Flow.from_client_config()` with `redirect_uri: "postmessage"` is the standard pattern for exchanging GIS code model auth codes.
- The refresh token from Google does not expire (until revoked by the user or invalidated by a password change). This is what enables "stay logged in forever".
