---
type: planning
entity: implementation-plan
plan: "drive-refresh-tokens"
phase: 1
status: draft
created: "2026-06-22"
updated: "2026-06-22"
---

# Implementation Plan: Phase 1 - Backend — Drive token endpoints

> Implements [Phase 1](../phases/phase-1.md) of [drive-refresh-tokens](../plan.md)

## Approach

Add a `GoogleToken` model that stores a per-user Google OAuth refresh token (one-to-one with `User`), an Alembic migration that creates the `google_tokens` table, a `services/drive.py` module that wraps `google-auth-oauthlib` for (a) exchanging a GIS code-model auth code for credentials and (b) refreshing an access token from a stored refresh token, and a `routers/drive.py` router that exposes three endpoints under `/api/v1/drive`. The exchange endpoint reuses the existing `google_auth_or_create` service to create/find the user from the ID token embedded in the exchanged credentials, then upserts the `GoogleToken` row and returns the existing `TokenResponse` (backend JWT). The token endpoint uses the existing `CurrentUser` JWT dependency, reads the stored refresh token, mints a fresh Google access token, caches it, and returns it as `DriveTokenResponse`. The revoke endpoint deletes the stored row.

All new code follows the existing patterns already established in the codebase: SQLAlchemy 2.0 `Mapped`/`mapped_column` typed columns (see `app/models/user.py`, `app/models/service_type.py`), UUID PKs with `default=uuid.uuid4`, `DateTime(timezone=True)` + `server_default=func.now()`, manual Alembic migrations (see `alembic/versions/001_initial.py`), Pydantic v2 `BaseModel` schemas, `APIRouter(prefix=..., tags=[...])` registered in `main.py` with `prefix="/api/v1"`, and `Annotated[AsyncSession, Depends(get_db)]` + `CurrentUser` dependency injection.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `backend/app/models/google_token.py` | create | New `GoogleToken` SQLAlchemy model (one-to-one with `User`) |
| `backend/app/models/user.py` | modify | Add `google_token` relationship (`back_populates`, `uselist=False`, `cascade="all, delete-orphan"`) |
| `backend/alembic/versions/002_add_google_tokens_table.py` | create | Manual migration creating `google_tokens` table with unique index on `user_id` |
| `backend/alembic/env.py` | modify | Add `google_token` to the model import line so Alembic registers it with `Base.metadata` |
| `backend/app/schemas/drive.py` | create | `ExchangeRequest` and `DriveTokenResponse` Pydantic schemas |
| `backend/app/services/drive.py` | create | `exchange_auth_code`, `refresh_access_token`, and ID-token-from-credentials helper |
| `backend/app/routers/drive.py` | create | `POST /exchange`, `GET /token`, `DELETE /revoke` endpoints |
| `backend/app/main.py` | modify | Import and register the `drive` router under `/api/v1` |

> Note: `docs/` does not exist in this repo, so module links point to source paths instead.

## Required Context

| File | Why |
|------|-----|
| `plans/drive-refresh-tokens/phases/phase-1.md` | Gated scope/DoD/acceptance criteria for this phase |
| `plans/drive-refresh-tokens/plan.md` | Global objective, requirements, and Definition of Done |
| `backend/app/models/user.py` | Pattern to match for UUID PK, timestamps, `Mapped` columns, and the `back_populates` relationship that must be extended |
| `backend/app/models/service_type.py` | Pattern to match for FK column (`ondelete="CASCADE"`, `index=True`) and `relationship("User", back_populates=...)` |
| `backend/app/database.py` | `Base` class and async `get_db` dependency (auto-commits on success, rolls back on error) |
| `backend/app/config.py` | `Settings` already exposes `google_client_id`, `google_client_secret`, `jwt_secret_key` — confirm no new settings are needed |
| `backend/app/services/auth.py` | `google_auth_or_create`, `verify_google_id_token`, `create_access_token`, `create_refresh_token` are reused by the drive router/service |
| `backend/app/routers/auth.py` | Router pattern to mirror: `APIRouter(prefix=..., tags=[...])`, `Annotated[AsyncSession, Depends(get_db)]`, `HTTPException`, `TokenResponse` |
| `backend/app/dependencies.py` | `CurrentUser` dependency (JWT `type: "access"` + `HTTPBearer`) used by `/drive/token` and `/drive/revoke` |
| `backend/app/schemas/auth.py` | `TokenResponse` (reused for `/drive/exchange` response) and schema style to match for `ExchangeRequest`/`DriveTokenResponse` |
| `backend/app/main.py` | Router import + `app.include_router(..., prefix="/api/v1")` registration pattern |
| `backend/alembic/env.py` | Line 25 imports models explicitly (`from app.models import user, service_type, time_entry`) — must add `google_token` here for Alembic auto-detection |
| `backend/alembic/versions/001_initial.py` | Manual migration pattern to follow: `revision`/`down_revision` strings, `op.create_table` with `postgresql.UUID(as_uuid=True)`, `op.create_index` |
| `backend/requirements.txt` | Confirm `google-auth-oauthlib==1.2.1` and `google-auth==2.37.0` are present (they are) |

## Implementation Steps

### Step 1: Create `GoogleToken` model

- **What**: Create `backend/app/models/google_token.py` with a `GoogleToken(Base)` class. Columns: `id` (UUID PK, `default=uuid.uuid4`), `user_id` (UUID FK → `users.id`, `ondelete="CASCADE"`, `nullable=False`, `index=True`, `unique=True` to enforce one-to-one), `google_refresh_token` (`String(1024)`, `nullable=False`), `google_access_token` (`String(2048)`, `nullable=True`), `access_token_expires_at` (`DateTime(timezone=True)`, `nullable=True`), `created_at`/`updated_at` (`DateTime(timezone=True)`, `server_default=func.now()`, `updated_at` also `onupdate=func.now()`). Add `user: Mapped["User"] = relationship("User", back_populates="google_token")`.
- **Where**: `backend/app/models/google_token.py` (new file)
- **Why**: Persistent storage for the Google refresh token; one row per user. Match the column/timestamp style of `app/models/user.py:9-27` and the FK style of `app/models/service_type.py:15-17`.
- **Considerations**: `user_id` must be `unique=True` to enforce the one-to-one constraint at the DB level (the phase says "one token per user"). `google_refresh_token` is the only strictly-required field for the refresh flow; access token + expiry are cached for opportunistic reuse but Phase 1 always refreshes on `/token` per the phase DoD.

### Step 2: Add `google_token` relationship to `User` model

- **What**: Add `google_token: Mapped["GoogleToken"] = relationship("GoogleToken", back_populates="user", uselist=False, cascade="all, delete-orphan")` to the `User` class in `backend/app/models/user.py`, next to the existing `service_types`/`time_entries` relationships (lines 30-35).
- **Where**: `backend/app/models/user.py` (modify — insert after the `time_entries` relationship block)
- **Why**: Required for `back_populates` on the `GoogleToken.user` relationship to resolve; `uselist=False` makes it one-to-one on the ORM side; `cascade="all, delete-orphan"` ensures tokens are deleted when a user is deleted (matches existing relationship style).
- **Considerations**: Use a forward-ref string `"GoogleToken"` with `# noqa: F821` to match the existing forward-ref style used for `service_types`/`time_entries`.

### Step 3: Update `alembic/env.py` to register the new model

- **What**: Change line 25 of `backend/alembic/env.py` from `from app.models import user, service_type, time_entry` to `from app.models import user, service_type, time_entry, google_token`.
- **Where**: `backend/alembic/env.py:25` (modify)
- **Why**: `target_metadata = Base.metadata` (line 27) only includes models that have been imported at module load time. Without this, Alembic will not see the `google_tokens` table and autogenerate/diff would miss it. This is the actual registration mechanism in this repo (not `app/models/__init__.py`, which is empty — see Reality Check).
- **Considerations**: This is a structural import-for-side-effect; the `# noqa: F401` comment already present covers the new module too.

### Step 4: Create the Alembic migration

- **What**: Create `backend/alembic/versions/002_add_google_tokens_table.py` with `revision = "002"`, `down_revision = "001"`, `branch_labels = None`, `depends_on = None`. `upgrade()` calls `op.create_table("google_tokens", ...)` with: `id` (`postgresql.UUID(as_uuid=True)`, primary_key=True), `user_id` (`postgresql.UUID(as_uuid=True)`, `ForeignKey("users.id", ondelete="CASCADE")`, nullable=False), `google_refresh_token` (`String(1024)`, nullable=False), `google_access_token` (`String(2048)`, nullable=True), `access_token_expires_at` (`DateTime(timezone=True)`, nullable=True), `created_at`/`updated_at` (`DateTime(timezone=True)`, `server_default=sa.func.now()`, nullable=False). Then `op.create_index("ix_google_tokens_user_id", "google_tokens", ["user_id"], unique=True)`. `downgrade()` calls `op.drop_table("google_tokens")`.
- **Where**: `backend/alembic/versions/002_add_google_tokens_table.py` (new file)
- **Why**: Follows the manual-migration convention established by `001_initial.py` (hand-written `op.create_table` with explicit `postgresql.UUID(as_uuid=True)` columns). The unique index on `user_id` enforces one-to-one at the DB level.
- **Considerations**: Match the existing revision-ID style (string `"002"`, not a hex hash). Do not rely on `alembic revision --autogenerate` — write it by hand to match `001_initial.py` and avoid drift from any local DB differences.

### Step 5: Create Pydantic schemas

- **What**: Create `backend/app/schemas/drive.py` with:
  - `class ExchangeRequest(BaseModel): code: str`
  - `class DriveTokenResponse(BaseModel): access_token: str`
- **Where**: `backend/app/schemas/drive.py` (new file)
- **Why**: Mirror the minimal style of `app/schemas/auth.py` (`GoogleAuthRequest` is a single-field `BaseModel`; `TokenResponse` is a flat response). `ExchangeRequest` is the request body for `POST /drive/exchange`; `DriveTokenResponse` is the response for `GET /drive/token` (a single Google access token).
- **Considerations**: Do not add fields the phase does not require (no `token_type`, no `expires_in`). The `/drive/exchange` response reuses the existing `TokenResponse` from `app/schemas/auth.py` directly (backend JWT pair), so no new schema is needed for it.

### Step 6: Create the Drive service

- **What**: Create `backend/app/services/drive.py` with three functions:
  - `exchange_auth_code(code: str) -> Credentials`: Build a `client_config` dict with a `"web"` key containing `client_id` (`settings.google_client_id`), `client_secret` (`settings.google_client_secret`), `auth_uri` (`"https://accounts.google.com/o/oauth2/auth"`), `token_uri` (`"https://oauth2.googleapis.com/token"`), and `"redirect_uris": ["postmessage"]`. Call `Flow.from_client_config(client_config, scopes=["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"], redirect_uri="postmessage")`, then `flow.fetch_token(code=code)`, then `return flow.credentials`.
  - `refresh_access_token(refresh_token: str) -> Credentials`: Construct `google.oauth2.credentials.Credentials(token=None, refresh_token=refresh_token, token_uri="https://oauth2.googleapis.com/token", client_id=settings.google_client_id, client_secret=settings.google_client_secret, scopes=["https://www.googleapis.com/auth/drive.file"])`, call `creds.refresh(google.auth.transport.requests.Request())`, return `creds`.
  - `get_user_id_from_credentials(creds: Credentials) -> str`: Reuse `app.services.auth.verify_google_id_token(creds.id_token)` and return `payload["sub"]`. (Used as a fallback/verification; the primary user-creation path in the router passes `creds.id_token` directly to `google_auth_or_create`.)
- **Where**: `backend/app/services/drive.py` (new file)
- **Why**: Encapsulates all `google-auth-oauthlib`/`google.oauth2` usage so the router stays thin (mirrors the `services/auth.py` split). `redirect_uri="postmessage"` is the standard value for GIS code-model server-side exchange (per phase Notes).
- **Considerations**: `Flow.from_client_config` validates that `redirect_uri` is in `client_config["web"]["redirect_uris"]` — both must be `"postmessage"`. `flow.credentials` after `fetch_token` exposes `.token` (access token), `.refresh_token`, `.expiry` (datetime), and `.id_token` (raw Google ID token string). `creds.refresh_token` may be `None` if the GIS client was not configured with `access_type="offline"` + consent — the router must handle this (Step 7). Scopes must match between `exchange_auth_code` and `refresh_access_token` so the refreshed token has the same permissions. Import `from app.config import get_settings` and read `settings = get_settings()` at module top (same pattern as `services/auth.py:15`).

### Step 7: Create the Drive router

- **What**: Create `backend/app/routers/drive.py` with `router = APIRouter(prefix="/drive", tags=["drive"])` and three endpoints:
  - `POST /exchange` (`response_model=TokenResponse`, `status_code=status.HTTP_201_CREATED`): Takes `payload: ExchangeRequest`, calls `exchange_auth_code(payload.code)` inside a try/except (raise `HTTPException(400, "Failed to exchange auth code: ...")` on failure). Reads `creds.id_token`; if falsy, raise `HTTPException(400, "No ID token in exchange response")`. Calls `await google_auth_or_create(db, creds.id_token)` inside try/except `ValueError` (raise `HTTPException(400, "Invalid Google token: ...")`, mirroring `routers/auth.py:64-73`). Checks `creds.refresh_token`; if `None`, raise `HTTPException(400, "No refresh token returned. Re-authorize with consent.")`. Then upserts the `GoogleToken` row: `select(GoogleToken).where(GoogleToken.user_id == user.id)`; if found, update `google_refresh_token`, `google_access_token`, `access_token_expires_at` from `creds`; else create a new `GoogleToken(user_id=user.id, google_refresh_token=creds.refresh_token, google_access_token=creds.token, access_token_expires_at=creds.expiry)` and `db.add(...)`. `await db.flush()`. Return `TokenResponse(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))`.
  - `GET /token` (`response_model=DriveTokenResponse`): Takes `current_user: CurrentUser` and `db: Annotated[AsyncSession, Depends(get_db)]`. Loads `GoogleToken` by `user_id == current_user.id`; if missing, raise `HTTPException(404, "No Google Drive token stored. Please re-authorize.")`. Calls `refresh_access_token(google_token.google_refresh_token)` inside try/except (raise `HTTPException(401, "Failed to refresh Google token: ...")` on failure — 401 signals the frontend to re-authorize per plan risk row). Updates `google_token.google_access_token = creds.token` and `google_token.access_token_expires_at = creds.expiry`, `await db.flush()`. Returns `DriveTokenResponse(access_token=creds.token)`.
  - `DELETE /revoke` (`status_code=status.HTTP_204_NO_CONTENT`): Takes `current_user: CurrentUser` and `db`. Loads the `GoogleToken` by `user_id`; if found, `await db.delete(google_token)` and `await db.flush()`. Returns `None` (204 No Content). If not found, still returns 204 (idempotent).
- **Where**: `backend/app/routers/drive.py` (new file)
- **Why**: Mirrors the `routers/auth.py` structure (`Annotated[AsyncSession, Depends(get_db)]`, `CurrentUser`, `HTTPException`, `TokenResponse`). Reuses `google_auth_or_create` per the phase Notes ("The exchange endpoint should reuse this logic"). Returns backend JWTs (not Google tokens) from `/exchange` per the phase scope, and a Google access token from `/token`.
- **Considerations**: `get_db` auto-commits on success (`database.py:31`) so no explicit `await db.commit()` is needed in the router — `flush()` is enough to make changes visible within the session and the commit happens at generator exit. Do NOT call Google's OAuth revoke endpoint in `/revoke` — the phase scope only says "Deletes the stored Google tokens for the user"; calling Google's revoke would invalidate the refresh token server-side which is also fine but is beyond the explicit DoD. Keep it to a DB delete for now (see Open Decisions).

### Step 8: Register the Drive router in `main.py`

- **What**: In `backend/app/main.py`, change line 7 from `from app.routers import auth, service_types, time_entries` to `from app.routers import auth, drive, service_types, time_entries`. After line 44 (`app.include_router(time_entries.router, prefix="/api/v1")`), add `app.include_router(drive.router, prefix="/api/v1")`.
- **Where**: `backend/app/main.py` (modify — import line and include_router block)
- **Why**: Required for the endpoints to be reachable under `/api/v1/drive/*` and to appear in `/docs`. Matches the existing registration pattern (lines 42-44).
- **Considerations**: Keep import ordering alphabetical-ish to match the existing `auth, service_types, time_entries` ordering style (insert `drive` after `auth`).

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Migration | `alembic upgrade head` against the real Supabase DB | `google_tokens` table created with columns and the unique `ix_google_tokens_user_id` index; `alembic downgrade -1` drops it cleanly |
| App startup | `uvicorn app.main:app --reload` (from `backend/`) | App starts with no import/registration errors; `/docs` shows the three `/api/v1/drive/*` endpoints |
| Exchange (E2E) | `POST /api/v1/drive/exchange` with a real GIS code-model auth code (obtained from a browser GIS flow) via `/docs` | 201 with `{ access_token, refresh_token, token_type }` (backend JWT pair); `google_tokens` row exists for the user with a non-null `google_refresh_token` |
| Token (E2E) | `GET /api/v1/drive/token` with the backend JWT from exchange (Bearer auth) | 200 with `{ access_token }` (a valid Google access token usable for Drive API); `google_tokens.google_access_token`/`access_token_expires_at` updated |
| Token repeat | Call `GET /api/v1/drive/token` again after the cached access token would expire | 200 with a fresh Google access token (refresh flow exercised) |
| Revoke | `DELETE /api/v1/drive/revoke` with the backend JWT | 204 No Content; subsequent `GET /api/v1/drive/token` returns 404 |
| Error: no token | `GET /api/v1/drive/token` with a valid backend JWT but no stored `GoogleToken` | 404 with a helpful detail message |
| Error: bad code | `POST /api/v1/drive/exchange` with an invalid/expired auth code | 400 with detail `"Failed to exchange auth code: ..."` |
| Error: unauthenticated | `GET /api/v1/drive/token` and `DELETE /api/v1/drive/revoke` without a Bearer token | 401/403 from `HTTPBearer` (existing dependency behavior) |

### Primary verify command

```powershell
cd backend; alembic upgrade head
```

This exercises the real changed database behavior (creates the `google_tokens` table on the real Supabase PostgreSQL instance) and fails loudly if the migration is malformed. It is the only Phase 1 change that can be fully exercised end-to-end without a real Google OAuth auth code.

The endpoint behavior (`/exchange`, `/token`, `/revoke`) cannot be exercised by a non-interactive command because `POST /drive/exchange` requires a real, short-lived Google auth code issued by GIS in a browser flow (with `redirect_uri=postmessage` and the correct OAuth client). Per the phase's own acceptance criteria, endpoint verification is manual via the `/docs` Swagger UI. This is flagged for the user: automated endpoint tests would require either (a) a test Google OAuth client with mock-able token responses, or (b) a FastAPI TestClient smoke test that only asserts routing/error behavior (401 without auth, 422 on bad body) without exercising the real Google exchange. Neither is in the Phase 1 deliverables.

### Test Integrity Constraints

- No existing tests are affected. The backend currently has **no test suite** — there is no `backend/tests/` directory, no `conftest.py`, no `pytest.ini`, and no `pyproject.toml` (verified via glob). Therefore no existing tests can be disabled, deleted, or weakened by this phase.
- If a test suite is introduced later, the following existing behaviors must not be broken by Phase 1: `POST /api/v1/auth/*` endpoints (unchanged), `GET /api/v1/service_types/*` and `/api/v1/time_entries/*` (unchanged), `GET /health` (unchanged), and the `User` model's existing relationships (`service_types`, `time_entries`) — the new `google_token` relationship is additive and must not alter existing cascade behavior.
- The `User` model change (Step 2) is additive (new relationship only) and must not change the `users` table schema or any existing column; the migration in Step 4 must not touch the `users` table.
- Manual Swagger testing of `/exchange` requires a real Google OAuth client configured for `redirect_uri=postmessage` and a real auth code — do not fabricate test credentials in the repo or commit `.env` values.

## Rollback Strategy

1. **Revert code**: `git revert` the Phase 1 commit (or `git restore` the affected files if uncommitted). The changes are confined to: one new model file, one new migration file, one new schema file, one new service file, one new router file, plus small edits to `app/models/user.py`, `alembic/env.py`, and `app/main.py`.
2. **Revert DB**: `alembic downgrade -1` (from `backend/`) drops the `google_tokens` table. This is safe because no other table references it (the FK is `google_tokens.user_id → users.id`, not the reverse).
3. **No data loss risk**: The only data created by Phase 1 is `google_tokens` rows, which are disposable (re-exchange re-creates them). Existing `users`, `service_types`, and `time_entries` rows are untouched by the migration.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Should `/drive/revoke` also call Google's OAuth revoke endpoint (`https://oauth2.googleapis.com/revoke?token=...`) | (a) DB delete only, (b) DB delete + Google revoke, (c) Google revoke only | (a) DB delete only | Phase scope says "Deletes the stored Google tokens for the user" — a DB delete satisfies the DoD. Calling Google revoke is extra scope and would invalidate the refresh token server-side, which is harder to recover from if the user re-signs-in. Can be added later if needed. |
| Should `app/models/__init__.py` be updated to export `GoogleToken` | (a) Leave empty, (b) Add `from app.models.google_token import GoogleToken` | (a) Leave empty | The existing `__init__.py` is empty and the codebase imports models directly (`from app.models.user import User`). Alembic registration happens via `alembic/env.py:25`, not `__init__.py`. Changing `__init__.py` would be a pattern shift with no functional benefit. |
| Scopes to request | (a) `drive.file` only, (b) `drive.appdata` + `drive.file`, (c) `drive` (full) | (a) `drive.file` + `openid email profile` | `drive.file` is the least-privilege scope that allows the app to create and read its own files in the user's Drive (sufficient for backup/restore per the plan). The existing GIS token-model flow almost certainly used `drive.file`; matching it avoids a re-consent prompt for existing users. `openid email profile` ensures the ID token is returned for user creation. |
| HTTP status for `/exchange` | 200 vs 201 | 201 | Matches the existing `POST /auth/register` endpoint (`status_code=status.HTTP_201_CREATED` in `routers/auth.py:32`), which is the closest analog (creates a user and returns tokens). |
| Caching strategy for `/token` | (a) Always refresh, (b) Return cached token if not near expiry, refresh otherwise | (a) Always refresh | Phase DoD says "uses the stored refresh token to get a fresh access token" and "Calling GET /drive/token again after the access token expires returns a freshly refreshed token". Always-refresh is simpler, always-correct, and the plan's NFR says "< 2 seconds" which a refresh easily meets. Caching is an optimization that can be added later. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `backend/app/models/user.py:9-37` | `User` class, UUID PK, `created_at`/`updated_at` pattern, `service_types`/`time_entries` relationships | Template for the `GoogleToken` model and the exact place to add the `google_token` back_populates relationship |
| `backend/app/models/service_type.py:15-17` | `user_id` FK column (`ondelete="CASCADE"`, `index=True`) | Template for the `GoogleToken.user_id` FK column |
| `backend/app/models/__init__.py` | (empty file) | Confirms model registration is NOT done via `__init__.py` exports — see Mismatches |
| `backend/app/database.py:23-24` | `Base(DeclarativeBase)` | The base class `GoogleToken` must inherit |
| `backend/app/database.py:27-35` | `get_db` async generator | Auto-commits on success, rolls back on error — confirms router does not need explicit `commit()` |
| `backend/app/config.py:28-29` | `google_client_id`, `google_client_secret` | Already present in `Settings` — no new settings needed for Phase 1 |
| `backend/app/services/auth.py:93-100` | `verify_google_id_token` | Reused to extract the Google ID from the ID token in the exchanged credentials |
| `backend/app/services/auth.py:103-134` | `google_auth_or_create` | Reused by `/drive/exchange` to create/find the user from the ID token (per phase Notes) |
| `backend/app/services/auth.py:38-49` | `create_access_token`, `create_refresh_token` | Reused by `/drive/exchange` to mint the backend JWT pair returned as `TokenResponse` |
| `backend/app/routers/auth.py:29` | `APIRouter(prefix="/auth", tags=["auth"])` | Template for `APIRouter(prefix="/drive", tags=["drive"])` |
| `backend/app/routers/auth.py:32-46` | `register` endpoint (201 + `TokenResponse`) | Template for `/drive/exchange` response shape and status code |
| `backend/app/routers/auth.py:64-73` | `google_auth` endpoint (try/except `ValueError` → `HTTPException(400)`) | Template for error handling around `google_auth_or_create` |
| `backend/app/dependencies.py:13,41` | `bearer_scheme`, `CurrentUser` | The auth dependency used by `/drive/token` and `/drive/revoke` |
| `backend/app/schemas/auth.py:15-22` | `GoogleAuthRequest`, `TokenResponse` | Template for `ExchangeRequest` (single-field request) and the reused `TokenResponse` |
| `backend/app/main.py:7,42-44` | Router imports and `include_router(..., prefix="/api/v1")` | Exact pattern to extend with the `drive` router |
| `backend/alembic/env.py:25` | `from app.models import user, service_type, time_entry` | The line that must be extended with `google_token` for Alembic to see the new table |
| `backend/alembic/versions/001_initial.py:11-14` | `revision = "001"`, `down_revision = None` | Template for the new migration's revision chaining (`revision="002"`, `down_revision="001"`) |
| `backend/alembic/versions/001_initial.py:18-30` | `op.create_table("users", ...)` with `postgresql.UUID(as_uuid=True)` | Template for `op.create_table("google_tokens", ...)` column style |
| `backend/requirements.txt:13-14` | `google-auth==2.37.0`, `google-auth-oauthlib==1.2.1` | Confirms the required dependencies for `services/drive.py` are already installed |
| `backend/.env.example:16-17` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Confirms env vars expected by `Settings` are already documented |

### Mismatches / Notes

- **`app/models/__init__.py` is empty (not a re-export module).** The phase Deliverables list says: "`backend/app/models/__init__.py` — export new model (if needed for Alembic auto-detection)". In reality, Alembic auto-detection in this repo is driven by the explicit import line in `backend/alembic/env.py:25` (`from app.models import user, service_type, time_entry`), **not** by `__init__.py` re-exports. The functional requirement is satisfied by Step 3 (editing `env.py`). Leaving `__init__.py` empty preserves the existing repo convention (see Open Decisions). No scope change needed — the deliverable's "if needed" qualifier covers this — but the implementer should be aware that editing `env.py` is the actual mechanism.
- **No test suite exists.** The phase Testing Strategy and Acceptance Criteria refer to manual Swagger testing. There is no `backend/tests/`, no `conftest.py`, no `pytest.ini`, no `pyproject.toml`. Consequently the "Test Integrity Constraints" subsection records "no existing tests affected" (vacuously true) and the primary verify command is `alembic upgrade head` (the only Phase 1 change exercisable without real Google credentials). Full endpoint E2E requires a real Google auth code and is manual per the phase's own criteria. Flagging for the user: if automated endpoint tests are desired, a separate effort to add `pytest` + `httpx.AsyncClient` test infrastructure is needed (out of Phase 1 scope).
- **`alembic.ini` has a placeholder `sqlalchemy.url`.** This is expected — `backend/alembic/env.py:17` overrides it from `DATABASE_URL` at runtime. No change to `alembic.ini` is needed for Phase 1.
- **`GoogleToken.user_id` uniqueness.** The phase says "one-to-one — one token per user". This is enforced two ways: (a) `unique=True` on the `user_id` column (DB-level) and (b) `uselist=False` on the `User.google_token` relationship (ORM-level). The router's upsert logic (Step 7) also handles the existing-row case via `scalar_one_or_none()`, so concurrent exchanges would rely on the DB unique constraint to prevent duplicates — acceptable for a single-user app per the plan's stated context.
- **`creds.refresh_token` may be `None` on `/exchange`.** Google only returns a refresh token when the GIS client requests `access_type="offline"` and the user consents (or `prompt="consent"` forces re-consent). This is a frontend (Phase 2) concern, but the backend must defend against it — Step 7 explicitly checks for `None` and returns a 400 instructing re-authorization. This does not change Phase 1 scope; it is defensive behavior within the endpoint.
- **`get_db` auto-commit means router code does not call `commit()`.** Verified at `backend/app/database.py:31` (`await session.commit()` runs on successful generator exit). The router uses `await db.flush()` to make writes visible within the session and push changes to the DB transaction; the commit happens at generator teardown. This matches the existing `routers/auth.py` pattern (which also never calls `commit()` explicitly).
