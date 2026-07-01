---
type: planning
entity: phase
plan: "supabase-migration"
phase: 1
status: pending
created: "2026-06-30"
updated: "2026-06-30"
---

# Phase 1: Supabase Schema & Auth Setup

> Part of [supabase-migration](../plan.md)

## Objective

Create the Supabase database schema (tables, RLS policies) and configure Google OAuth authentication. Provide the user with manual setup instructions for Supabase dashboard and Google Cloud Console.

## Scope

### Includes

- SQL migration script: 6 tables with proper types, foreign keys, and indexes
- RLS policies: enable on all tables, `user_id = auth.uid()` for all CRUD
- Auth configuration: enable Google provider in Supabase, get redirect URI
- Google Cloud Console configuration: OAuth consent screen, redirect URI
- Env var documentation: what to set in `.env.local` and Netlify
- `Row-Level Security` (RLS) is enabled on ALL tables

### Excludes (deferred to later phases)

- Frontend code changes (Phase 2+)
- Supabase client integration (Phase 3)
- Removing Drive code (Phase 4)
- Data migration (manual export/import by user)

## Prerequisites

- [ ] Access to existing Supabase project (or create new one)
- [ ] Access to Google Cloud Console (existing OAuth project `239823436666-l9857mtjqou52t4b799hhrc50d5nll9p`)
- [ ] Supabase CLI installed (optional, for local migrations) or SQL Editor access in dashboard

## Deliverables

- [ ] `sql/001_schema.sql` — table creation SQL
- [ ] `sql/002_rls.sql` — RLS policy SQL
- [ ] `SETUP.md` — step-by-step manual setup instructions for user
- [ ] Updated `web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Acceptance Criteria

- [ ] SQL scripts execute without errors in Supabase SQL Editor
- [ ] All 6 tables exist with correct columns and types
- [ ] RLS is enabled on all tables
- [ ] `INSERT` as authenticated user succeeds, `INSERT` as anonymous fails
- [ ] Google OAuth is enabled in Supabase Auth → Providers
- [ ] Google sign-in works from Supabase dashboard test
- [ ] User can follow SETUP.md instructions without assistance

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 2 | Blocks | Auth provider needs tables + Google OAuth configured |
| Phase 3 | Blocks | Supabase client needs tables to CRUD |

## Notes

- The existing backend database (Supabase) has `users`, `service_types`, `time_entries` tables with backend-specific schemas. We'll create **new** tables with an `app_` prefix or in a separate schema to avoid conflicts. The backend tables will be dropped in Phase 4.
- Use `uuid` for primary keys (matching frontend UUID-as-string pattern), `timestamptz` for dates, `jsonb` for complex objects if needed.
- The `profile` table holds one row per user (1:1 with auth.users).
- `settings` could be a single `jsonb` column or normalized columns. Single `jsonb` is simpler for frontend integration (serialize/deserialize as object).
- `service_types`, `time_entries`, `goals`, `interested_people` are arrays — each gets its own table with `user_id` FK.
