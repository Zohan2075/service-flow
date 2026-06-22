---
type: planning
entity: todo
plan: "drive-refresh-tokens"
updated: "2026-06-22"
---

# Todo: drive-refresh-tokens

> Tracking [drive-refresh-tokens](plan.md)

## Active Phase: 1 - Backend — Drive token endpoints

### Phase Context

- **Scope**: [Phase 1](phases/phase-1.md)
- **Implementation**: [Phase 1 Plan](implementation/phase-1-impl.md) <!-- to be created by author-and-verify-implementation-plan -->
- **Latest Handover**: <!-- update when handover is created -->
- **Relevant Docs**: 
  - `backend/app/models/user.py` — User model
  - `backend/app/services/auth.py` — JWT + Google auth helpers
  - `backend/app/routers/auth.py` — existing auth endpoints
  - `backend/app/dependencies.py` — CurrentUser dependency
  - `backend/app/database.py` — DB session + Base
  - `backend/app/config.py` — Settings (has GOOGLE_CLIENT_SECRET)

### Pending

- [ ] Create `GoogleToken` SQLAlchemy model <!-- added: 2026-06-22 -->
- [ ] Create Alembic migration for `google_tokens` table <!-- added: 2026-06-22 -->
- [ ] Create Pydantic schemas for drive endpoints <!-- added: 2026-06-22 -->
- [ ] Create drive service (token exchange + refresh logic) <!-- added: 2026-06-22 -->
- [ ] Create drive router (`/exchange`, `/token`, `/revoke`) <!-- added: 2026-06-22 -->
- [ ] Register drive router in `main.py` <!-- added: 2026-06-22 -->
- [ ] Test backend endpoints via `/docs` Swagger UI <!-- added: 2026-06-22 -->

### In Progress

### Completed

### Blocked

## Changelog

### 2026-06-22

- Plan created with 3 phases: backend endpoints, frontend integration, deploy + test
