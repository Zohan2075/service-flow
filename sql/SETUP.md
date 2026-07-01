# ServiceFlow Supabase Migration — Setup Guide

## Overview

You're migrating from Google Drive as your database to Supabase (PostgreSQL) with Google OAuth login. This guide walks you through the manual setup steps. After setup, the code changes in this PR handle everything else.

**You already have a Supabase project** connected to your backend. We'll use the same project but create new tables and enable Auth.

---

## Step 1: Configure Google OAuth for Supabase

### 1a. Add Supabase Redirect URI to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
3. Click the pencil/edit icon
4. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   *(Replace with your actual Supabase project ref — find it in Supabase Dashboard → Settings → General)*
5. Also keep your existing redirect URIs (localhost:3000, service-flow-sp.netlify.app, etc.)
6. Click **Save**

> **Find your Supabase redirect URI**: Go to Supabase Dashboard → **Authentication** → **Providers** → **Google** — it shows the callback URL.

### 1b. Enable Google Provider in Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com/) → select your project
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and toggle it **ON**
4. Enter:
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
5. Click **Save**

### 1c. Configure Auth Settings (optional but recommended)

In **Authentication** → **Settings**:
- **Site URL**: `https://service-flow-sp.netlify.app` (your frontend URL)
- **Redirect URLs**: Add `https://service-flow-sp.netlify.app` and `http://localhost:3000`

---

## Step 2: Create Database Tables

### Run the SQL schema

1. Go to Supabase Dashboard → **SQL Editor**
2. Open and run **`sql/001_schema.sql`** (creates all 6 tables)
3. Open and run **`sql/002_rls.sql`** (enables Row-Level Security)
4. Verify: Go to **Table Editor** — you should see these tables:
   - `profiles`
   - `settings`
   - `service_types`
   - `time_entries`
   - `goals`
   - `interested_people`

> **Existing tables**: Your backend already has tables named `service_types`, `time_entries`, etc. These are in a different schema or can coexist. The new tables are in the `public` schema with RLS. After migration, you can safely drop the old backend tables from the SQL Editor.

---

## Step 3: Set Up Environment Variables

### 3a. Development (local)

Update `web/.env.local`:

```env
# Supabase (REQUIRED — replaces Google Drive config)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Remove these old Drive-specific vars:
# NEXT_PUBLIC_GOOGLE_CLIENT_ID  ← DELETE
# NEXT_PUBLIC_API_URL           ← DELETE
```

> **Get your anon key**: Supabase Dashboard → **Settings** → **API** → **Project API keys** → `anon/public` key. It starts with `sb_publishable_`.

### 3b. Production (Netlify)

1. Go to [Netlify](https://app.netlify.com/) → your site `service-flow-sp`
2. Navigate to **Site configuration** → **Environment variables**
3. Add these variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `YOUR_SUPABASE_ANON_KEY`
4. Remove these old variables:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` ← can keep if you want, but not needed
   - `NEXT_PUBLIC_API_URL` ← DELETE (backend being removed)
5. Redeploy (trigger from Netlify or push to git)

---

## Step 4: Archive the Backend (optional, after migration is verified)

Once you confirm everything works with Supabase:

```bash
# Move backend to legacy archive
mv backend backend-legacy

# Delete the Cloud Build trigger
gcloud builds triggers delete service-flow-deploy --region=northamerica-south1
```

Or just leave it — it won't be used by the new frontend code.

---

## Step 5: Verify

1. Visit `https://service-flow-sp.netlify.app` (or `localhost:3000`)
2. Click **"Continue with Google"**
3. After sign-in, you should see your profile in the sidebar
4. Go to **Settings** → check that it shows "Connected to Supabase"
5. Add a time entry, refresh the page — data should persist
6. Check Supabase Table Editor to confirm data is stored

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Error: redirect_uri_mismatch" | Go to Google Cloud Console → Credentials → add the Supabase callback URL (see Step 1a) |
| "Auth session missing" | Check NEXT_PUBLIC_SUPABASE_URL and ANON_KEY are correct in Netlify |
| "policy violation" / "permission denied" | RLS policies might not be applied — re-run `sql/002_rls.sql` |
| Existing data missing after migration | Use Settings → **Export JSON** before migration, then **Import JSON** after |
| "Provider is not enabled" | Go to Supabase → Authentication → Providers → enable Google |
