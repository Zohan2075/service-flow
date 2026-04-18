# ServiceFlow

ServiceFlow is a service-time tracking workspace with a web app, a FastAPI backend, and a Flutter mobile client. The current day-to-day experience is centered on the web app, which stores data locally in the browser and can optionally back up to Google Drive.

| Component | Stack |
|---|---|
| Web | Next.js 15, React 19, TailwindCSS, Zustand |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Mobile | Flutter, Riverpod, Go Router |
| Auth | Google Sign-In / Google Identity Services |
| Storage | IndexedDB, JSON export/import, Google Drive backup/restore |

## Highlights

- Calendar-based logging for both time and unit entries
- Service types own their entry mode, so each service is either time-based or unit-based
- Optional entry titles that fall back to the selected service type name
- Named service goals and combined goals
- Reusable yearly goal cycles with configurable start month, defaulting to September
- Monthly and annual reports with clearer goal progress, percentages, and completion states
- Shared month context between Calendar and Reports
- English and Spanish UI
- Light, dark, and system theme support
- Offline-first web storage with JSON export/import and Google Drive backup/restore

## Repository Layout

```text
.
|- web/      Next.js web app
|- backend/  FastAPI API and migrations
|- mobile/   Flutter mobile app
|- netlify.toml
```

## Web Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

To build the production export:

```bash
cd web
npm run build
```

## Backend Quick Start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On macOS or Linux, activate the environment with `source .venv/bin/activate`.

## Mobile Quick Start

```bash
cd mobile
flutter pub get
flutter run
```

## Web Deployment

The web app is configured for static export so Netlify can publish it directly.

1. Connect the repository in Netlify.
2. Netlify will read `netlify.toml` automatically.
3. Set the production environment variable below in Netlify if you want Google sign-in and Drive backup enabled.

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Effective Netlify settings:

```text
Base directory: web
Build command: npm run build
Publish directory: out
```

## Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project and open APIs & Services > Credentials
3. Create an OAuth 2.0 Client ID for a Web application
4. Add `http://localhost:3000` and your production URL to Authorized JavaScript origins
5. Enable the Google Drive API under APIs & Services > Library
6. Create `web/.env.local` with:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

For Netlify production, add the same variable in the site environment settings and include your deployed domain in the authorized origins.

## Data Notes

The web app stores its working data in IndexedDB. Export/import and Google Drive backup use the same JSON payload containing profile, settings, service types, time entries, and goals.

## Donations

If ServiceFlow is useful to you, you can support development here:

- Ko-fi: https://ko-fi.com/U7U81WJ6BY
- In the web app: Settings > Account > Support on Ko-fi
