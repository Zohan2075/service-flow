---
type: planning
entity: phase
plan: "drive-refresh-tokens"
phase: 3
status: pending
created: "2026-06-22"
updated: "2026-06-22"
---

# Phase 3: Deploy + configure + end-to-end test

> Part of [drive-refresh-tokens](../plan.md)

## Objective

Deploy the FastAPI backend to a hosting platform, configure Google Cloud Console for the code model flow, update the frontend environment, and verify the full auto-sync flow works end-to-end on a mobile PWA without popups.

## Scope

### Includes

- Deploy backend to Render.com (recommended) or equivalent platform
  - Configure environment variables (Supabase, Google, JWT secrets)
  - Set start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
  - Verify health endpoint (`GET /health`) responds
- Google Cloud Console configuration:
  - Ensure OAuth client is "Web application" type
  - Add backend URL to authorized JavaScript origins (if needed for CORS)
  - Verify `postmessage` redirect URI works (no explicit redirect URI entry needed for this flow)
  - Confirm `GOOGLE_CLIENT_SECRET` is available and added to backend env
- Frontend environment update:
  - Add `NEXT_PUBLIC_API_URL` to `netlify.toml` build environment
  - Add `NEXT_PUBLIC_API_URL` to `web/.env.local` for local dev
  - Update `web/.env.local.example`
- SW cache bump (`serviceflow-v4`)
- End-to-end testing on mobile PWA:
  - Fresh sign-in → one-time popup → verify backend JWT stored
  - Make an edit → wait 30s → verify Drive backup updated (no popup)
  - Close and reopen PWA → verify auto-sync on open (no popup)
  - Wait > 1 hour → verify auto-sync still works (refresh token)
  - Manual "Backup to Drive" → works
  - Manual "Restore from Drive" → works
  - Sign out → tokens revoked

### Excludes

- Performance optimization
- Monitoring / alerting setup
- Custom domain for the backend (can use the platform's default subdomain)

## Prerequisites

- [ ] Phase 1 complete — backend code is ready
- [ ] Phase 2 complete — frontend code is ready
- [ ] Supabase project accessible with correct connection string
- [ ] Google Cloud Console access (to configure OAuth client)
- [ ] Google client secret available

## Deliverables

- [ ] Backend deployed and accessible via HTTPS URL
- [ ] `GET /health` returns `{"status": "ok"}` on the deployed URL
- [ ] `POST /api/v1/drive/exchange` works on the deployed URL
- [ ] `GET /api/v1/drive/token` works on the deployed URL
- [ ] `netlify.toml` updated with `NEXT_PUBLIC_API_URL` build env var
- [ ] Frontend rebuilt and deployed to Netlify with the new env var
- [ ] SW cache bumped to `v4`
- [ ] All acceptance criteria from Phase 2 verified on the deployed app

## Acceptance Criteria

- [ ] Backend health check passes on deployed URL
- [ ] Fresh sign-in on mobile PWA → one-time popup → success
- [ ] Auto-sync after edit → no popup → Drive backup updated
- [ ] Auto-sync on app reopen → no popup → works
- [ ] Auto-sync after 1+ hour → no popup → works (refresh token)
- [ ] Manual backup/restore work via backend token path
- [ ] Sign out revokes tokens
- [ ] No console errors in production

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 1 | blocked-by | Backend code must be complete |
| 2 | blocked-by | Frontend code must be complete |

## Notes

- **Render.com deployment**: Create a new "Web Service" from the GitHub repo, set root directory to `backend/`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Free tier is sufficient for a single-user app.
- **CORS**: The backend already has CORS middleware configured for `settings.frontend_url` and localhost. Add the deployed frontend URL to `allow_origins` in `main.py` or configure via `FRONTEND_URL` env var.
- **Google Cloud Console**: The OAuth client ID `239823436666-l9857mtjqou52t4b799hhrc50d5nll9p.apps.googleusercontent.com` is already configured. Verify it's "Web application" type and that the client secret is accessible. The `postmessage` redirect URI is a Google built-in that doesn't require explicit configuration.
- **Environment variables on Render**: Set all variables from `backend/.env.example` with real values from Supabase and Google Cloud Console.
