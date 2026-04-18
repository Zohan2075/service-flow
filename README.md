# ServiceFlow

A browser-based service time tracking app. All data lives in the browser (IndexedDB) with optional Google Drive backup.

| Component | Stack |
|---|---|
| **Web** | Next.js 15 · React 19 · TailwindCSS · Zustand |
| **Auth** | Google Sign-In (Google Identity Services) |
| **Storage** | IndexedDB (runtime) · JSON file (export/import) · Google Drive (backup/restore) |

---

## Features

- Calendar-based service time logging
- Time and units entry support
- Customizable service types with colors and Material icons
- Time entry modes: exact start/end time range, or manual duration
- Monthly and yearly reports with per-service-type breakdowns
- Per-service and combined monthly/yearly goals in reports
- Light / Dark / System theme
- Export & import data as a single JSON file
- Manual backup & restore via Google Drive
- Fully offline — no backend required

---

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

---

## Netlify Deployment

The web app is configured for static export so Netlify can publish it directly.

1. Connect the repository in Netlify.
2. Netlify will read `netlify.toml` automatically.
3. Set the production environment variable below in Netlify if you want Google sign-in and Drive backup enabled.

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The effective Netlify settings are:

```text
Base directory: web
Build command: npm run build
Publish directory: out
```

---

## Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins: `http://localhost:3000` (and your production URL)
5. Enable the **Google Drive API** under APIs & Services → Library
6. Create a `.env.local` file in the `web/` directory:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

For Netlify production, add the same variable in the Netlify site environment settings and include your Netlify domain in the authorized JavaScript origins.

---

## Data Model

All data is stored in a single JSON document:

```json
{
  "version": 1,
  "exported_at": "ISO 8601",
  "profile": { "google_id", "name", "email", "image" },
  "settings": { "theme": "light|dark|system" },
  "service_types": [{ "id", "name", "color", "icon", ... }],
  "time_entries": [{ "id", "title", "start_time", "end_time", "duration_seconds", "units_quantity", ... }],
  "goals": [{ "id", "scope", "service_type_id", "service_type_ids", ... }]
}
```

The same format is used for local export/import and Google Drive backup/restore.

---

## Theme & Colors

- **Primary**: `#2094f3`
- **Background Light**: `#f5f7f8`
- **Background Dark**: `#101a22`
- Service types have customizable colors + Material Symbols icons
- Supports Light / Dark / System theme switching
