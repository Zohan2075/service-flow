# ServiceFlow 🗂️

A full-stack service time tracking application with:

| Layer | Stack |
|---|---|
| **Backend** | Python · FastAPI · SQLAlchemy async · Alembic · Supabase (PostgreSQL) |
| **Web** | Next.js 15 · TailwindCSS · NextAuth · TanStack Query |
| **Mobile** | Flutter · Riverpod · go_router · TableCalendar |
| **Auth** | JWT + Google OAuth (email/password also supported) |

---

## 📁 Project Structure

```
Service tracker/
├── backend/          # FastAPI REST API
├── web/              # Next.js web dashboard
└── mobile/           # Flutter Android app
```

---

## 🚀 Quick Start

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (anon public)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (connection string using `postgresql+asyncpg://...`)
3. Go to **Authentication → Providers** and enable **Google**
4. Add your Google OAuth credentials (from Google Cloud Console)

---

### 2. Google Cloud OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (web dev)
   - Your production URL
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

---

### 3. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase + Google credentials

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 4. Web App

```bash
cd web

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev
```

Open: http://localhost:3000

---

### 5. Flutter Mobile App

```bash
cd mobile

# Get packages
flutter pub get

# Run code generation (for Riverpod etc.)
dart run build_runner build --delete-conflicting-outputs

# Run on Android emulator (API URL auto-points to 10.0.2.2:8000)
flutter run

# Build release APK
flutter build apk --release
```

> **Note:** For physical device, set `API_BASE_URL` in `lib/core/network/dio_provider.dart` to your machine's LAN IP.

---

## 🏛️ Database Schema

```sql
users
  id UUID PK
  email VARCHAR(255) UNIQUE
  full_name VARCHAR(255)
  avatar_url VARCHAR(1024)
  hashed_password VARCHAR(1024)
  google_id VARCHAR(255) UNIQUE
  is_active BOOLEAN
  is_verified BOOLEAN
  created_at / updated_at TIMESTAMPTZ

service_types
  id UUID PK
  user_id UUID FK→users
  name VARCHAR(100)
  description VARCHAR(500)
  color VARCHAR(7)      -- hex #rrggbb
  icon VARCHAR(50)      -- Material icon name
  sort_order INT
  is_active BOOLEAN
  created_at / updated_at TIMESTAMPTZ

time_entries
  id UUID PK
  user_id UUID FK→users
  service_type_id UUID FK→service_types
  title VARCHAR(200)
  notes TEXT
  location VARCHAR(255)
  start_time TIMESTAMPTZ
  end_time TIMESTAMPTZ
  duration_seconds INT
  created_at / updated_at TIMESTAMPTZ
```

---

## 🔌 API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register with email+password |
| POST | `/api/v1/auth/login` | Login with email+password |
| POST | `/api/v1/auth/google` | Exchange Google ID token for JWT |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user |
| GET | `/api/v1/service-types` | List service types |
| POST | `/api/v1/service-types` | Create service type |
| PATCH | `/api/v1/service-types/:id` | Update service type |
| DELETE | `/api/v1/service-types/:id` | Delete service type |
| GET | `/api/v1/time-entries` | List entries (filterable) |
| GET | `/api/v1/time-entries/calendar?month=&year=` | Calendar view grouped by day |
| POST | `/api/v1/time-entries` | Create time entry |
| PATCH | `/api/v1/time-entries/:id` | Update entry |
| DELETE | `/api/v1/time-entries/:id` | Delete entry |

---

## 🎨 Theme & Colors

The design follows the **ServiceFlow** design system:

- **Primary**: `#2094f3` (blue)
- **Background Light**: `#f5f7f8`
- **Background Dark**: `#101a22`
- Service types have customizable colors + Material icons

Supports **Light / Dark / System** theme switching on both Web and Mobile.
