# Supabase Migration Inventory — ServiceFlow Codebase

> **Purpose**: Comprehensive inventory of current state to plan migration from Google-Drive-based sync to Supabase as the primary database.
>
> **Generated**: 2026-06-30

---

## 1. All Data Types

**File**: `web/src/types/data.ts` (214 lines)

### 1.1 `UserProfile`
| Field | Type | Notes |
|-------|------|-------|
| `google_id` | `string` | Google user ID (`sub` claim) |
| `name` | `string` | Google display name |
| `email` | `string` | Google email |
| `image` | `string \| null` | Google profile picture URL |
| `displayName?` | `string \| null` | User-editable display name (synced) |
| `bio?` | `string \| null` | User-editable bio text (synced) |
| `customImage?` | `string \| null` | User-uploaded photo as data URL (synced) |

### 1.2 `AppSettings`
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `theme` | `"light" \| "dark" \| "system"` | `"system"` | |
| `language` | `"en" \| "es"` | `"en"` | |
| `accentColor` | `string` | `"#2094f3"` | hex color |
| `customSurfaceLight` | `string \| null` | `null` | light theme surface override |
| `customSurfaceDark` | `string \| null` | `null` | dark theme surface override |
| `customBackgroundLight` | `string \| null` | `null` | light theme bg override |
| `customBackgroundDark` | `string \| null` | `null` | dark theme bg override |
| `customSurface?` | `string \| null` | — | **legacy** import compat (maps to light+dark) |
| `customBackground?` | `string \| null` | — | **legacy** import compat |
| `weekStartsOn` | `"sunday" \| "monday"` | `"sunday"` | |
| `defaultEntryMode` | `"range" \| "duration"` | `"duration"` | new entry default |
| `defaultDurationHours` | `number` | `1` | |
| `defaultDurationMinutes` | `number` | `0` | |
| `planModeEnabled` | `boolean` | `false` | toggles planned entry toggle |
| `showYearTotals` | `boolean` | `true` | reports display |
| `autoSync` | `boolean` | `true` | **Drive-specific** — auto backup toggle |
| `lastSyncedAt` | `string \| null` | `null` | **Drive-specific** — ISO 8601 timestamp |

> Two fields are Drive-specific: `autoSync` and `lastSyncedAt`. The rest are app-general.

### 1.3 `ServiceType`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `name` | `string` | |
| `description` | `string \| null` | |
| `entry_type` | `"time" \| "units"` | |
| `color` | `string` | hex |
| `icon` | `string` | Material Symbols name |
| `sort_order` | `number` | |
| `is_active` | `boolean` | |
| `created_at` | `string` | ISO 8601 |
| `updated_at` | `string` | ISO 8601 |

### 1.4 `TimeEntry`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `title` | `string` | defaults to service type name if empty |
| `notes` | `string \| null` | |
| `location` | `string \| null` | |
| `start_time` | `string` | ISO 8601 |
| `end_time` | `string \| null` | ISO 8601 |
| `duration_seconds` | `number \| null` | |
| `units_quantity` | `number \| null` | for unit entries |
| `units_label` | `string \| null` | label for units |
| `service_type_id` | `string` | FK to ServiceType |
| `is_planned` | `boolean` | plan mode flag |
| `created_at` | `string` | ISO 8601 |
| `updated_at` | `string` | ISO 8601 |

### 1.5 `GoalDefinition`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `name` | `string` | |
| `scope` | `"service" \| "combined"` | |
| `service_type_id` | `string \| null` | for per-service goals |
| `service_type_ids` | `string[]` | for combined goals |
| `monthly_duration_seconds` | `number \| null` | |
| `monthly_units_quantity` | `number \| null` | |
| `yearly_duration_seconds` | `number \| null` | |
| `yearly_units_quantity` | `number \| null` | |
| `yearly_start_month` | `number` | 1-12, default 9 |
| `created_at` | `string` | ISO 8601 |
| `updated_at` | `string` | ISO 8601 |

### 1.6 `InterestedPerson`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `name` | `string` | |
| `last_name` | `string` | |
| `gender` | `"male" \| "female"` | |
| `age` | `number \| null` | |
| `address` | `string \| null` | |
| `comments` | `string \| null` | |
| `latitude` | `number \| null` | |
| `longitude` | `number \| null` | |
| `initial_conversation_date` | `string \| null` | ISO 8601 date |
| `next_visit_date` | `string \| null` | ISO 8601 date |
| `status` | `"bible_student" \| "return_visit" \| "interested_person"` | |
| `created_at` | `string` | ISO 8601 |
| `updated_at` | `string` | ISO 8601 |

### 1.7 `BackupFile` (the JSON schema for Drive sync / export)
| Field | Type | Notes |
|-------|------|-------|
| `version` | `1` | schema version |
| `exported_at` | `string` | ISO 8601 |
| `profile` | `UserProfile \| null` | |
| `settings` | `AppSettings` | |
| `service_types` | `ServiceType[]` | snake_case in JSON |
| `time_entries` | `TimeEntry[]` | |
| `goals?` | `GoalDefinition[]` | optional |
| `interested_people?` | `InterestedPerson[]` | optional |

### 1.8 `CalendarDay` (derived/computed, not persisted)
| Field | Type |
|-------|------|
| `date` | `string` (yyyy-MM-dd) |
| `entries` | `TimeEntry[]` |
| `total_duration_seconds` | `number` |
| `total_duration_display` | `string` |
| `total_units` | `number` |
| `planned_duration_seconds` | `number` |
| `planned_duration_display` | `string` |
| `planned_units` | `number` |

### 1.9 Helper types
- `WeekStart`: `"sunday" | "monday"`
- `Language`: `"en" | "es"`
- `GoalScope`: `"service" | "combined"`
- `InterestedPersonStatus`: `"bible_student" | "return_visit" | "interested_person"`

### 1.10 Utility functions in data.ts
- `isUnitsEntry(entry)` — checks if units_quantity > 0
- `isPlannedEntry(entry)` — checks `is_planned`
- `computeDurationSeconds(entry)` — from duration_seconds or start/end diff
- `durationDisplay(seconds)` → "1h 30m" or "45m"
- `calendarDateKey(iso)` → "yyyy-MM-dd"
- `buildCalendarDays(entries, year, month)` → `CalendarDay[]`

---

## 2. Auth Flow

### 2.1 Frontend: `web/src/components/GoogleAuthProvider.tsx` (397 lines)

**Architecture**: React Context Provider wrapping Google Identity Services (GIS) Code Model.

**GIS Initialization**:
1. `CLIENT_ID` comes from `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID` (line 71)
2. `SCOPES` = `"openid profile email https://www.googleapis.com/auth/drive.file"` (line 72)
3. On mount, `ensureCodeClient()` loads the GIS script from `https://accounts.google.com/gsi/client` via dynamic `<script>` tag (line 167)
4. Initializes `google.accounts.oauth2.initCodeClient()` with `client_id`, `scope`, `redirect_uri` = `window.location.origin` (lines 174-179)

**Auth State**:
| State | Type | Source |
|-------|------|--------|
| `user` | `UserProfile \| null` | derived from `storeProfile` (Zustand) |
| `accessToken` | `string \| null` | volatile in-memory Google Drive access token |
| `isLoading` | `boolean` | true while GIS script loads |
| `isReady` | `boolean` | `!isLoading` |
| `isConfigured` | `boolean` | `Boolean(CLIENT_ID)` |
| `hasStoredBackendJwt` | `boolean` | whether `serviceflow-backend-jwt` exists in localStorage |
| `error` | `string \| null` | auth/config errors |
| `backendJwt` | `string \| null` | local state, hydrated from localStorage on mount |
| `codeClient` | `google.accounts.oauth2.CodeClient \| null` | GIS code client instance |

**Backend JWT Storage** (lines 74-101):
- Key: `"serviceflow-backend-jwt"` in `localStorage`
- Stored by `storeBackendJwt()`, retrieved by `getStoredBackendJwt()`, cleared by `clearStoredBackendJwt()`

**Sign-In Flow** (`signIn()`, lines 269-294):
1. `requestCode()` → opens GIS code popup (15s timeout, line 222)
2. `exchangeDriveCode(code, origin)` → POST to backend `/api/v1/drive/exchange` (in `api.ts`)
3. Backend returns `{ access_token, refresh_token }` (these are **backend JWTs**, not Google tokens)
4. Store backend JWT in localStorage
5. `getDriveToken(backendJwt)` → GET `/api/v1/drive/token` to get actual Google access token
6. Call Google `userinfo` endpoint with Google token to fetch profile
7. Call `setProfile(profile)` on Zustand store

**Drive Token Acquisition** (`requestDriveAccess()`, lines 296-344):
- **Silent path**: Uses stored backend JWT → calls `getDriveToken()` on backend → backend refreshes Google token using stored refresh token → returns fresh Google access token
- **Interactive fallback**: If silent fails (no JWT, expired, revoked), opens GIS code popup → exchanges code → stores new backend JWT → gets Google token

**Sign-Out** (`signOutHandler()`, lines 346-359):
- Calls `revokeDriveToken(jwt)` on backend (DELETE `/api/v1/drive/revoke`) — best-effort, ignores errors
- Calls `google.accounts.id.disableAutoSelect()`
- Clears localStorage JWT
- Calls `storeSignOut()` (Zustand action resets all state)

**Mount-time Initialization** (lines 363-369):
- Calls `ensureCodeClient()` on mount to preload GIS

### 2.2 Frontend API Layer: `web/src/lib/api.ts` (34 lines)

Three functions that communicate with backend:

| Function | Method | Endpoint | Input | Output |
|----------|--------|----------|-------|--------|
| `exchangeDriveCode` | POST | `/api/v1/drive/exchange` | `{ code, redirect_uri }` | `{ access_token, refresh_token }` (backend JWTs) |
| `getDriveToken` | GET | `/api/v1/drive/token` | Bearer JWT header | `{ access_token }` (Google token) |
| `revokeDriveToken` | DELETE | `/api/v1/drive/revoke` | Bearer JWT header | void |

`API_URL` comes from `process.env.NEXT_PUBLIC_API_URL`.

### 2.3 Component Tree (Providers)

**File**: `web/src/components/Providers.tsx` (46 lines)

Provider nesting order:
```
GoogleAuthProvider
  └─ ThemeProvider
       └─ I18nProvider
            └─ SyncBridge (wraps SyncProvider, bridges GoogleAuth → sync)
                 └─ children + Toaster
```

**SyncBridge** (lines 10-26): Creates two callbacks that bridge auth to sync:
- `getInteractiveToken`: calls `requestDriveAccess({ interactive: true })`
- `getSilentToken`: calls `requestDriveAccess({ interactive: false })`

These are passed as props to `SyncProvider`.

### 2.4 Backend Auth Architecture

**File**: `backend/app/routers/auth.py` (98 lines)

Auth router at `/api/v1/auth`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/register` | POST | Email+password registration → returns backend JWTs |
| `/login` | POST | Email+password login → returns backend JWTs |
| `/google` | POST | Google ID token auth → verify + create/find user → returns backend JWTs |
| `/refresh` | POST | Refresh access token using refresh token |
| `/me` | GET | Return current user (requires Bearer JWT) |

**File**: `backend/app/services/auth.py` (134 lines)
- `hash_password` / `verify_password` — bcrypt via passlib
- `create_access_token` / `create_refresh_token` / `decode_token` — JWT via python-jose (HS256)
- `verify_google_id_token` — verifies Google ID token with google-auth library
- `google_auth_or_create` — finds user by google_id, or by email, or creates new user

### 2.5 GIS Type Declarations

**File**: `web/src/types/google.d.ts` (92 lines)

Declares `google.accounts.id.*` and `google.accounts.oauth2.*` namespaces including `CodeClient`, `CodeResponse`, `TokenClient`, `TokenResponse`, `NonOAuthError`.

---

## 3. Drive Sync Flow

### 3.1 Drive API Helpers: `web/src/lib/drive.ts` (128 lines)

**Constants**:
- `DRIVE_API` = `"https://www.googleapis.com/drive/v3"`
- `UPLOAD_API` = `"https://www.googleapis.com/upload/drive/v3"`
- `FILE_NAME` = `"serviceflow-backup.json"`
- `MIME` = `"application/json"`

**Functions**:

| Function | Purpose | Key behavior |
|----------|---------|--------------|
| `findBackupFile(token)` | List Drive files named `serviceflow-backup.json`, not trashed | Returns file ID or null |
| `uploadBackup(token, json)` | Upload or update the backup file | If existing file found → PATCH (update content); else → POST multipart upload |
| `downloadBackup(token)` | Download backup file content | Finds file by name, downloads via `?alt=media`, returns text |
| `parseDriveError(action, res)` | Parse Drive API error responses | Handles 401 (session expired), 403 (insufficient scopes, API not enabled), generic |

### 3.2 Sync Provider: `web/src/lib/sync.tsx` (223 lines)

**Types**:
- `SyncStatus`: `"idle" | "syncing" | "error"`
- `SyncState`: `{ status, error }`
- `SyncContextValue`: extends SyncState + `syncNow(tokenOverride?)` + `isOnline`

**Context**: `SyncContext` with `useSync()` hook.

**SyncProvider props**:
```ts
{
  getInteractiveToken: (() => Promise<string>) | null;
  getSilentToken: (() => Promise<string>) | null;
  children: ReactNode;
}
```

**Internal state**:
- `state` (SyncState): `{ status: "idle", error: null }`
- `isOnline`: navigator.onLine
- `syncingRef`: prevents concurrent syncs
- `autoSyncRef`: always holds latest autoSync function
- `debounceRef`: debounce timer handle

**Auto-sync debounce**: `AUTOSYNC_DEBOUNCE_MS = 30_000` (30 seconds)

**`performSync(token)`** (lines 79-96):
1. Gets current timestamp as `syncedAt`
2. Reads entire Zustand store state via `useStore.getState()`
3. Calls `serializeBackup()` to create `BackupFile` JSON
4. Calls `uploadBackup(token, json)` to upload to Drive
5. Calls `completeSync(syncedAt)` → clears `hasPendingChanges`, sets `lastSyncedAt`
6. Flushes microtask queue to let Zustand persist middleware write to IndexedDB

**`syncNow(tokenOverride?)`** (lines 98-118):
- Checks online status
- Sets status to "syncing"
- Gets token via `tokenOverride ?? getInteractiveToken()`
- Calls `performSync(token)` — **updates** UI status (syncing → idle/error)
- Throws on error (for callers to show toast)

**`autoSync()`** (lines 121-176) — silent, no UI state changes:
1. **Skips if**: already syncing, offline, `autoSync` disabled in settings, no silent token getter
2. Gets token via `getSilentToken()`
3. **If `hasPendingChanges`**: uploads via `performSync(token)` — "uploaded changes"
4. **If no pending changes**: downloads backup from Drive, compares `backup.settings.lastSyncedAt` vs local `lastSyncedAt`, if remote is newer → `importData(parsed, { source: "remote" })` — "auto-restore"

**Trigger points for auto-sync**:
1. **Mount** (line 185-188): 500ms delay (waits for IndexedDB hydration)
2. **Visibility change** (line 189-193): when tab becomes visible again
3. **Debounced after edit** (line 202-216): 30s after `hasPendingChanges` becomes true

**`isOnline` tracking** (lines 64-77): Listens to `online`/`offline` window events; triggers autoSync when coming back online.

### 3.3 Complete Sync Flow Diagram

```
User action / auto-trigger
  └─► getInteractiveToken() or getSilentToken()
        └─► GoogleAuthProvider.requestDriveAccess()
              ├─ Silent: backend JWT → GET /api/v1/drive/token → Google token
              └─ Interactive: GIS popup → code → POST /api/v1/drive/exchange → JWT → GET token
                    └─► performSync(googleToken)
                          ├─ serializeBackup(store state) → BackupFile JSON
                          ├─ uploadBackup(token, json) → Drive API (find + PATCH or multipart POST)
                          └─ completeSync(syncedAt) → clear hasPendingChanges, set lastSyncedAt
```

### 3.4 Serializer: `web/src/lib/store.ts` (lines 927-962)

**`serializeBackup(state)`** → `BackupFile`:
- Constructs `{ version: 1, exported_at, profile, settings, service_types, time_entries, goals, interested_people }`

**`deserializeBackup(raw)`** → `BackupFile`:
- Validates: object, version=1, service_types array, time_entries array
- Returns cast object

---

## 4. Store Structure: `web/src/lib/store.ts` (962 lines)

### 4.1 Storage Layer

**IndexedDB adapter** (lines 17-63):
- DB name: `"serviceflow"`, store name: `"kv"`, version 1
- Uses `createJSONStorage` from Zustand
- Key operations: `getItem(key)`, `setItem(key, value)`, `removeItem(key)` — all async
- **Note**: This is the current local persistence. In Supabase migration, this would be replaced or supplemented by server-side persistence.

### 4.2 Zustand Persist Config (lines 886-922)

```ts
persist(
  (set, get) => ({ /* state + actions */ }),
  {
    name: "serviceflow-data",          // IndexedDB key
    storage: createIDBStorage(),       // custom IndexedDB adapter
    partialize: (state) => ({          // only persist these fields:
      profile,
      settings,
      serviceTypes,
      timeEntries,
      goals,
      interestedPeople,
      syncMetadata,
    }),
    merge: (persisted, current) => {   // deep-merge on hydration
      // normalizes settings, service types, time entries, goals
      // normalizes profile (image, displayName, bio)
      // preserves current uiState
    },
  }
)
```

### 4.3 AppState Interface (lines 68-120)

**Data fields**:
| Field | Type | Initial Value |
|-------|------|---------------|
| `profile` | `UserProfile \| null` | `null` |
| `settings` | `AppSettings` | `INITIAL_SETTINGS` |
| `serviceTypes` | `ServiceType[]` | `ensureServiceTypesNotEmpty([], ...)` |
| `timeEntries` | `TimeEntry[]` | `[]` |
| `goals` | `GoalDefinition[]` | `[]` |
| `interestedPeople` | `InterestedPerson[]` | `[]` |
| `syncMetadata` | `SyncMetadata` | `{ hasPendingChanges: false }` |
| `uiState` | `UiState` | `{ viewedMonth: startOfMonth(new Date()) }` |

### 4.4 All Actions

**Auth actions**:
- `setProfile(p)` — merges live Google profile with editable fields; handles account switch (resets all data)
- `signOut()` — resets all state to defaults

**Settings/Profile**:
- `updateSettings(patch)` — normalizes settings; marks `hasPendingChanges` if sync-relevant change
- `updateProfile(patch)` — updates displayName/bio/customImage; marks pending

**Service Type**:
- `addServiceType(st)` — generates UUID, sort_order; marks pending
- `ensureDefaultServiceType()` → returns first service type ID, creates default if none
- `updateServiceType(id, patch)` — marks pending
- `moveServiceType(id, direction)` — reorders; marks pending
- `reorderServiceTypes(orderedIds)` — DnD reorder; marks pending
- `deleteServiceType(id)` — removes service type + associated goals; cannot delete last; marks pending

**Time Entry**:
- `addTimeEntry(entry)` — generates UUID, resolves title; marks pending
- `updateTimeEntry(id, patch)` — marks pending
- `deleteTimeEntry(id)` — marks pending

**Goals**:
- `addGoal(goal)` — normalizes + validates; marks pending
- `updateGoal(id, patch)` — normalizes; may delete if targets removed; marks pending
- `deleteGoal(id)` — marks pending

**Interested People**:
- `addInterestedPerson(person)` — marks pending
- `updateInterestedPerson(id, patch)` — marks pending
- `deleteInterestedPerson(id)` — marks pending

**Navigation (uiState — NOT persisted)**:
- `setViewedMonth(date)`
- `goToPreviousViewedMonth()`
- `goToNextViewedMonth()`
- `goToToday()`

**Bulk data**:
- `importData(file, options?)` — imports BackupFile; source "remote" clears pending changes, "local" marks pending; merges profile
- `completeSync(syncedAt)` — sets lastSyncedAt, clears hasPendingChanges
- `resetData()` — resets all state to defaults; marks pending

### 4.5 SyncMetadata
```ts
interface SyncMetadata {
  hasPendingChanges: boolean;
}
```
Initial: `{ hasPendingChanges: false }`

`withPendingSync(state)` — helper that sets `syncMetadata.hasPendingChanges = true`.

`SYNC_ONLY_SETTING_KEYS` = `["lastSyncedAt", "autoSync"]` — changes to these settings do NOT trigger `hasPendingChanges`.

### 4.6 Initial Values
- `INITIAL_SETTINGS`: all defaults (see section 1.2)
- `INITIAL_SYNC_METADATA`: `{ hasPendingChanges: false }`
- `INITIAL_UI_STATE`: `{ viewedMonth: startOfMonth(new Date()) }`

### 4.7 Important Normalizers
- `normalizeSettings(settings?)` — merges with defaults, handles legacy `customSurface`/`customBackground`
- `normalizeTimeEntry(entry)` — ensures units_quantity, units_label, is_planned are never undefined
- `normalizePersistedProfile(profile)` — normalizes image URLs on hydration
- `mergeLiveProfile(current, incoming)` — merges Google sign-in with user-editable fields
- `mergeImportedProfile(current, imported)` — merges imported profile preserving auth-only fields
- `normalizeGoals(goals, serviceTypeMap)` — validates all goals, drops invalid ones

---

## 5. Settings Page Drive UI

**File**: `web/src/app/(dashboard)/settings/page.tsx` (1999 lines)

### 5.1 Drive-Related State/Refs
```ts
const [driveLoading, setDriveLoading] = useState(false);
// Computed:
const isDriveBusy = driveLoading || googleLoading || sync.status === "syncing";
const hasPendingChanges = useStore((s) => s.syncMetadata.hasPendingChanges);
```

### 5.2 `ensureDriveAccess()` (lines 350-360)
- If `!isConfigured` → throws error with `t("settings.driveConfigHint")`
- If `!user` → calls `signIn()` (opens GIS popup)
- Returns `requestDriveAccess({ interactive: true })` → Google access token

### 5.3 `handleDriveBackup()` (lines 362-373)
- Calls `ensureDriveAccess()` → gets token
- Calls `sync.syncNow(token)` → uploads to Drive
- Shows toast: success/failure

### 5.4 `handleDriveRestore()` (lines 394-406)
- Calls `ensureDriveAccess()` → gets token
- Calls `restoreBackupFromDrive(token)` which: downloads JSON → parses → deserializes → `importData(backup, { source: "remote" })`
- Calls `completeSync(new Date().toISOString())`
- Shows toast

### 5.5 Drive UI Elements (in "Data" category `activeCategory === "data"`)

**Config hint** (lines 1217-1221): Amber warning if `!isConfigured` — "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID..."

**Auth error** (lines 1223-1227): Red box if `googleError && isConfigured`

**Drive connection status** (lines 1229-1250): Shows one of three states:
| State | Icon | Title key | Subtitle key |
|-------|------|-----------|-------------|
| `!user` | `account_circle` (gray) | `settings.notSignedIn` | `settings.signInFirst` |
| `hasStoredBackendJwt` | `cloud_done` (green) | `settings.driveConnected` | `settings.driveReady` |
| else (user but no JWT) | `cloud_sync` (amber) | `settings.driveNotConnected` | `settings.connectDriveOnce` |

**Auto-sync toggle** (lines 1252-1271):
- Switch widget for `settings.autoSync`
- Label: `settings.autoSync`, sub: `settings.autoSyncDesc`
- Calls `updateSettings({ autoSync: !settings.autoSync })`

**Backup status widget** (lines 1275-1304): Shows one of four states:
| Condition | Icon | Text key |
|-----------|------|----------|
| `sync.status === "syncing"` | `sync` (spin) | `settings.syncing` |
| `sync.status === "error"` | `error` (red) | `settings.syncError` + error message |
| `hasPendingChanges` | `cloud_upload` (amber) | `settings.pendingBackup` |
| else | `cloud_done` (green) | `settings.noPendingChanges` |

Also shows `lastSyncedAt` timestamp when available and no error.

**Manual Backup button** (lines 1309-1319):
- Icon: `cloud_upload` (green)
- Text: `settings.backupDrive` / `settings.backupDriveDesc`
- Disabled when: `isDriveBusy || !isConfigured`
- OnClick: `handleDriveBackup`

**Manual Restore button** (lines 1321-1331):
- Icon: `cloud_download` (blue)
- Text: `settings.restoreDrive` / `settings.restoreDriveDesc`
- Disabled when: `isDriveBusy || !isConfigured`
- OnClick: `handleDriveRestore`

### 5.6 Export/Import (non-Drive, in same "Data" category)

**Export** (lines 316-326): `handleExport()` — serializes to blob, triggers download via `<a>` element.

**Import** (lines 329-347): `handleImport()` — file input for `.json`, parses, deserializes, calls `importData(backup)`.

### 5.7 Danger Zone (separate "danger" category)
- "Reset All Data" with confirmation step
- `handleReset()` → `resetData()` + toast

---

## 6. Backend

### 6.1 Directory Structure

```
backend/
├── .env                          # Real env (with secrets — DO NOT COMMIT)
├── .env.example                  # Template
├── .venv/                        # Python virtualenv
├── alembic.ini                   # Alembic config
├── alembic/
│   ├── env.py                    # Migration runner (async, loads DATABASE_URL from env)
│   └── versions/
│       ├── 001_initial.py        # users, service_types, time_entries
│       └── 002_add_google_tokens_table.py  # google_tokens
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app, CORS, router registration
│   ├── config.py                 # Pydantic Settings (loads .env)
│   ├── database.py               # SQLAlchemy async engine + session factory + Base
│   ├── dependencies.py           # get_current_user dependency (JWT bearer)
│   ├── models/
│   │   ├── __init__.py           # (empty)
│   │   ├── user.py               # User ORM model
│   │   ├── service_type.py       # ServiceType ORM model
│   │   ├── time_entry.py         # TimeEntry ORM model
│   │   └── google_token.py       # GoogleToken ORM model (Drive tokens)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py               # /api/v1/auth/*
│   │   ├── drive.py              # /api/v1/drive/*
│   │   ├── service_types.py      # /api/v1/service-types/*
│   │   └── time_entries.py       # /api/v1/time-entries/*
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py               # Register, Login, GoogleAuth, Token, Refresh
│   │   ├── drive.py              # ExchangeRequest, DriveTokenResponse
│   │   ├── service_type.py       # Create, Update, Response
│   │   ├── time_entry.py         # Create, Update, Response, CalendarDayResponse
│   │   └── user.py               # UserCreate, UserUpdate, UserResponse
│   └── services/
│       ├── __init__.py
│       ├── auth.py               # Password hashing, JWT, Google OAuth verification
│       └── drive.py              # exchange_auth_code, refresh_access_token
└── requirements.txt              # FastAPI, SQLAlchemy, asyncpg, alembic, etc.
```

### 6.2 Database Schema (Supabase PostgreSQL)

**Table: `users`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `email` | VARCHAR(255) UNIQUE NOT NULL INDEX | |
| `full_name` | VARCHAR(255) NULL | |
| `avatar_url` | VARCHAR(1024) NULL | |
| `hashed_password` | VARCHAR(1024) NULL | bcrypt; null for Google-only users |
| `google_id` | VARCHAR(255) UNIQUE NULL INDEX | |
| `is_active` | BOOLEAN DEFAULT true | |
| `is_verified` | BOOLEAN DEFAULT false | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | |

**Table: `service_types`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID FK→users(id) CASCADE INDEX | |
| `name` | VARCHAR(100) NOT NULL | |
| `description` | VARCHAR(500) NULL | |
| `color` | VARCHAR(7) DEFAULT '#2094f3' | hex |
| `icon` | VARCHAR(50) DEFAULT 'work' | |
| `is_active` | BOOLEAN DEFAULT true | |
| `sort_order` | INTEGER DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Table: `time_entries`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID FK→users(id) CASCADE INDEX | |
| `service_type_id` | UUID FK→service_types(id) CASCADE INDEX | |
| `title` | VARCHAR(200) NOT NULL | |
| `notes` | TEXT NULL | |
| `location` | VARCHAR(255) NULL | |
| `start_time` | TIMESTAMPTZ NOT NULL INDEX | |
| `end_time` | TIMESTAMPTZ NULL | |
| `duration_seconds` | INTEGER NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Table: `google_tokens`** (Drive-specific, to be removed in migration)
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID FK→users(id) CASCADE UNIQUE INDEX | |
| `google_refresh_token` | VARCHAR(1024) NOT NULL | |
| `google_access_token` | VARCHAR(2048) NULL | |
| `access_token_expires_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 6.3 API Endpoints

| Method | Path | Purpose | Drive-Dependent? |
|--------|------|---------|------------------|
| POST | `/api/v1/auth/register` | Email registration | No |
| POST | `/api/v1/auth/login` | Email login | No |
| POST | `/api/v1/auth/google` | Google ID token auth | No (uses Google ID token, not Drive) |
| POST | `/api/v1/auth/refresh` | Refresh JWT | No |
| GET | `/api/v1/auth/me` | Current user profile | No |
| **POST** | **`/api/v1/drive/exchange`** | **Exchange GIS code → JWT + store Google tokens** | **YES** |
| **GET** | **`/api/v1/drive/token`** | **Get fresh Google access token** | **YES** |
| **DELETE** | **`/api/v1/drive/revoke`** | **Delete stored Google tokens** | **YES** |
| GET | `/api/v1/service-types/` | List service types | No |
| POST | `/api/v1/service-types/` | Create service type | No |
| GET | `/api/v1/service-types/{id}` | Get service type | No |
| PATCH | `/api/v1/service-types/{id}` | Update service type | No |
| DELETE | `/api/v1/service-types/{id}` | Delete service type | No |
| GET | `/api/v1/time-entries/` | List time entries (filters: month, year, service_type_id) | No |
| GET | `/api/v1/time-entries/calendar` | Calendar month view (grouped by day) | No |
| POST | `/api/v1/time-entries/` | Create time entry | No |
| GET | `/api/v1/time-entries/{id}` | Get time entry | No |
| PATCH | `/api/v1/time-entries/{id}` | Update time entry | No |
| DELETE | `/api/v1/time-entries/{id}` | Delete time entry | No |

**Already on Supabase**: The backend already connects to Supabase PostgreSQL via `DATABASE_URL`. The `/api/v1/drive/*` endpoints are the only Drive-specific ones.

### 6.4 Missing from Backend (not yet implemented)
- Goals CRUD endpoints
- Interested People CRUD endpoints
- User profile update (displayName, bio, customImage) — the `/auth/me` returns user but there's no update endpoint
- App settings CRUD endpoints
- Any sync/backup endpoint that doesn't use Drive

### 6.5 Infrastructure

**File**: `Dockerfile` (root, 15 lines)
- Python 3.12-slim
- Copies backend code
- Runs `uvicorn app.main:app --host 0.0.0.0 --port 8080`
- Deployed on Google Cloud Run

**File**: `cloudbuild.yaml` (root, 26 lines)
- Google Cloud Build config
- Builds Docker image → pushes to GCR → deploys to Cloud Run in `northamerica-south1`
- `--allow-unauthenticated` (no IAP)

**File**: `netlify.toml` (root, 9 lines)
- Builds from `web/` directory
- `npm run build`, publishes `out/` (static export)
- Env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_URL` = Cloud Run URL

---

## 7. i18n Keys

**File**: `web/src/lib/i18n.tsx` (684 lines)

### 7.1 Drive/Sync-Related Keys

| Key | English Value |
|-----|---------------|
| `settings.driveSync` | "Google Drive Backup" |
| `settings.autoSync` | "Auto-sync to Google Drive" |
| `settings.autoSyncDesc` | "Automatically back up changes to Drive when online" |
| `settings.driveConfigHint` | "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app to enable Google sign-in and Drive backup." |
| `settings.notSignedIn` | "Google account not signed in" |
| `settings.driveConnected` | "Google Drive connected" |
| `settings.driveNotConnected` | "Google Drive access not granted yet" |
| `settings.signInFirst` | "Backup or restore will ask you to sign in when needed." |
| `settings.driveReady` | "Up to date" |
| `settings.connectDriveOnce` | "Backup or restore will request Drive access when needed." |
| `settings.signInGoogle` | "Sign in with Google" |
| `settings.pendingBackup` | "Local changes not yet backed up" |
| `settings.noPendingChanges` | "All changes backed up" |
| `settings.synced` | "Synced" |
| `settings.syncing` | "Backing up to Drive" |
| `settings.syncError` | "Backup error" |
| `settings.offlineShort` | "Offline" |
| `settings.last` | "Last" |
| `settings.manual` | "Backup & Restore" |
| `settings.backupDrive` | "Backup to Google Drive" |
| `settings.backupDriveDesc` | "Upload the current app data to your Drive backup" |
| `settings.restoreDrive` | "Restore from Google Drive" |
| `settings.restoreDriveDesc` | "Download the latest Drive backup into this device" |
| `settings.backedUp` | "Backed up to Google Drive!" |
| `settings.restored` | "Restored from Google Drive!" |
| `settings.driveBackupFailed` | "Drive backup failed" |
| `settings.driveRestoreFailed` | "Drive restore failed" |

**Also present in Spanish (`es`) translations** — all have corresponding Spanish equivalents.

### 7.2 Other Settings-Related Keys (non-Drive)

| Key | English |
|-----|---------|
| `settings.title` | "Settings" |
| `settings.profile` | "Profile" |
| `settings.editProfile` | "Edit profile" |
| `settings.displayName` | "Display Name" |
| `settings.bioNotes` | "Bio / Notes" |
| `settings.bioPlaceholder` | "A short note about yourself..." |
| `settings.save` | "Save" |
| `settings.cancel` | "Cancel" |
| `settings.profileUpdated` | "Profile updated" |
| `settings.profilePhotoHint` | "Upload a photo to override the Google image..." |
| `settings.appearance` | "Appearance" |
| `settings.theme` | "Theme" |
| `settings.light` | "☀️ Light" |
| `settings.dark` | "🌙 Dark" |
| `settings.system` | "💻 System" |
| `settings.accentColor` | "Accent Color" |
| `settings.customSurface` | "Custom Surface" |
| `settings.customBackground` | "Custom Background" |
| `settings.resetDefault` | "Reset to default" |
| `settings.language` | "Language" |
| `settings.dataManagement` | "Data Management" |
| `settings.exportJson` | "Export" |
| `settings.importJson` | "Import" |
| `settings.dangerZone` | "Danger Zone" |
| `settings.resetAll` | "Reset All Data" |
| `settings.dataBackup` | "Data & Backup" |
| *(plus ~40 more goal/service-type/entry settings keys)* |

### 7.3 Offline-Related Keys
| Key | English |
|-----|---------|
| `offline.banner` | "You're offline — changes are saved locally" |
| `offline.syncPending` | "Changes will sync when you're back online" |

### 7.4 Login-Related Keys
| Key | English |
|-----|---------|
| `login.welcome` | "Welcome back" |
| `login.googleHint` | "Google sign-in needs a Google OAuth client id..." |
| `login.continueGoogle` | "Continue with Google" |
| `login.loadingGoogle` | "Loading Google sign-in..." |
| `login.footnote` | "Sign in with your Google account to save your profile locally and connect Google Drive backup." |

---

## 8. Service Worker

**File**: `web/public/sw.js` (100 lines)

**Cache version**: `"serviceflow-v8"`

**Scope**: All GET requests. Bypasses on `localhost`.

**Strategies**:
| URL Pattern | Strategy |
|-------------|----------|
| `fonts.googleapis.com` / `fonts.gstatic.com` | Cache-first |
| `/_next/static/*` (hashed assets) | Cache-first |
| All other same-origin (HTML navigations, etc.) | Network-first with cache fallback |
| Cross-origin (Google APIs, CDN scripts, etc.) | Bypassed (no SW handling) |

**Cache-first**: Try cache → on miss fetch + cache + return. On fetch fail → 504.

**Network-first**: Try fetch → cache + return. On fail → check cache → if navigation, fallback to cached `/`. On total fail → 503 "Offline".

**Registration**: Done in `web/src/app/layout.tsx` (line 9) via inline script. In dev mode, unregisters old SW and cleans caches.

**Impact on migration**: If switching from offline-first to online-first, the SW strategy may need updating. Currently caches page HTML but Drive API calls are not cached (cross-origin bypass).

---

## 9. Netlify / Env

### 9.1 Netlify Config

**File**: `netlify.toml` (root, 9 lines)
```toml
[build]
  base = "web"
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "20"
  NEXT_PUBLIC_GOOGLE_CLIENT_ID = "239823436666-....apps.googleusercontent.com"
  NEXT_PUBLIC_API_URL = "https://service-flow-api-239823436666.northamerica-south1.run.app"
```

### 9.2 Env Files

**`web/.env.local`** (3 lines):
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=239823436666-....apps.googleusercontent.com
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`web/.env.local.example`** (3 lines):
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_API_URL=your-backend-url
```

**`backend/.env`** (26 lines): Contains real secrets including:
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase PostgreSQL direct connection with credentials)
- `JWT_SECRET_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL`, `BACKEND_URL`

**`backend/.env.example`** (23 lines): Template with placeholder values. Documents all required env vars.

### 9.3 Key Env Variables Summary

| Variable | Used In | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend | GIS initialization, Google sign-in |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL |
| `DATABASE_URL` | Backend | Supabase PostgreSQL direct connection (asyncpg) |
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_KEY` | Backend | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase service role key |
| `JWT_SECRET_KEY` | Backend | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Backend | Google OAuth server-side |
| `GOOGLE_CLIENT_SECRET` | Backend | Google OAuth server-side secret |
| `FRONTEND_URL` | Backend | CORS allow-origin |

---

## 10. Blast Radius — All Files Importing Drive/Sync/Auth Modules

### 10.1 Files importing from `@/lib/drive` or `./drive`

| File | Import | Usage |
|------|--------|-------|
| `web/src/lib/sync.tsx:13` | `import { uploadBackup, downloadBackup } from "./drive"` | `performSync()` calls `uploadBackup`, `autoSync()` calls `downloadBackup` |
| `web/src/app/(dashboard)/settings/page.tsx:24` | `import { downloadBackup } from "@/lib/drive"` | `restoreBackupFromDrive()` calls `downloadBackup` |

**Total: 2 files**

### 10.2 Files importing from `@/lib/sync` or `./sync`

| File | Import | Usage |
|------|--------|-------|
| `web/src/components/Providers.tsx:7` | `import { SyncProvider } from "@/lib/sync"` | Wraps app in SyncProvider via SyncBridge |
| `web/src/components/OfflineBanner.tsx:3` | `import { useSync } from "@/lib/sync"` | Reads `isOnline` to show/hide offline banner |
| `web/src/app/(dashboard)/settings/page.tsx:25` | `import { useSync } from "@/lib/sync"` | Reads `sync.status`, `sync.syncNow`, `sync.isOnline` for Drive UI |

**Total: 3 files**

### 10.3 Files importing from `@/components/GoogleAuthProvider`

| File | Import | Usage |
|------|--------|-------|
| `web/src/components/Providers.tsx:4` | `import { GoogleAuthProvider, useGoogleAuth } from "@/components/GoogleAuthProvider"` | Composes GoogleAuthProvider + creates SyncBridge |
| `web/src/app/(dashboard)/settings/page.tsx:23` | `import { useGoogleAuth } from "@/components/GoogleAuthProvider"` | Reads `user`, `isConfigured`, `error`, `hasStoredBackendJwt`, `requestDriveAccess`, `signIn`, `isLoading` for Drive UI |
| `web/src/app/login/page.tsx:5` | `import { useGoogleAuth } from "@/components/GoogleAuthProvider"` | Reads `user`, `isLoading`, `isConfigured`, `error`, `signIn` for login page |
| `web/src/components/layout/Sidebar.tsx:5` | `import { useGoogleAuth } from "@/components/GoogleAuthProvider"` | Reads `user`, `signOut` for sidebar user display + sign-out button |

**Total: 4 files**

### 10.4 Combined Blast Radius (all unique files touching Drive/Sync/Auth)

| # | File | Touches |
|---|------|---------|
| 1 | `web/src/lib/drive.ts` | **Source** — Drive API helpers |
| 2 | `web/src/lib/sync.tsx` | **Source** — Sync provider, depends on drive.ts + store.ts |
| 3 | `web/src/lib/store.ts` | **Source** — serializeBackup, deserializeBackup, SyncMetadata, completeSync, importData |
| 4 | `web/src/lib/api.ts` | **Source** — exchangeDriveCode, getDriveToken, revokeDriveToken |
| 5 | `web/src/components/GoogleAuthProvider.tsx` | **Source** — GIS auth, Drive token management, depends on api.ts + store.ts |
| 6 | `web/src/components/Providers.tsx` | Composes GoogleAuthProvider + SyncProvider |
| 7 | `web/src/components/OfflineBanner.tsx` | Reads sync `isOnline` |
| 8 | `web/src/app/(dashboard)/settings/page.tsx` | Drive backup/restore UI, sync status, import { downloadBackup } |
| 9 | `web/src/app/login/page.tsx` | Google sign-in UI |
| 10 | `web/src/components/layout/Sidebar.tsx` | User display + sign-out |
| 11 | `web/src/app/layout.tsx` | Mounts Providers (which mounts GoogleAuthProvider + SyncProvider) |
| 12 | `web/src/app/(dashboard)/layout.tsx` | Mounts OfflineBanner (which reads sync) |
| 13 | `web/src/types/google.d.ts` | GIS type declarations |
| 14 | `web/src/types/data.ts` | BackupFile schema, AppSettings.autoSync, AppSettings.lastSyncedAt |

**Files in `web/src/` NOT touched**: `utils.ts`, `ThemeProvider.tsx`, AddEntryModal, InterestedPersonModal, calendar page, reports page, interested page (these don't import Drive/Sync/Auth directly).

### 10.5 Backend Files to Remove/Modify

| File | Action |
|------|--------|
| `backend/app/routers/drive.py` | **REMOVE** — all 3 Drive endpoints |
| `backend/app/schemas/drive.py` | **REMOVE** — ExchangeRequest, DriveTokenResponse |
| `backend/app/services/drive.py` | **REMOVE** — exchange_auth_code, refresh_access_token |
| `backend/app/models/google_token.py` | **REMOVE** — GoogleToken ORM model |
| `backend/alembic/versions/002_add_google_tokens_table.py` | **REVERSE** migration or keep as historical |
| `backend/requirements.txt` | Remove `google-auth`, `google-auth-oauthlib` (if no longer needed) |
| `backend/app/config.py` | Remove `google_client_id`, `google_client_secret` |
| `backend/app/main.py` | Remove `drive` router include |

### 10.6 Summary Stats

| Metric | Count |
|--------|-------|
| Frontend source files total | 27 |
| Files in blast radius | 14 |
| Backend files to remove | 6+ |
| Drive-specific i18n keys | 27 (en) + 27 (es) = 54 |
| Drive-specific Zustand fields | `autoSync`, `lastSyncedAt`, `SyncMetadata.hasPendingChanges` (partially) |
| Backend endpoints to remove | 3 (`/drive/exchange`, `/drive/token`, `/drive/revoke`) |
| Database tables to drop | 1 (`google_tokens`) |
| Env vars to deprecate | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (backend), `SUPABASE_*` (depends on new approach) |

---

## Appendix: Migration Considerations (quick notes)

1. **Auth**: Google sign-in currently serves dual purpose — user identity + Drive access. After migration, Google auth could be used purely for identity (simpler: Google ID token → backend JWT, no Drive scopes needed). Or Supabase Auth could replace it entirely.

2. **Offline-first vs online-first**: Current architecture is offline-first (IndexedDB + Drive sync). Migration to Supabase could go either way: keep offline-first with periodic sync, or become online-first with optimistic UI.

3. **Data model alignment**: Frontend types use `string` IDs (UUIDs as strings), ISO 8601 date strings. Backend uses proper UUID and TIMESTAMPTZ types. A mapping layer will be needed.

4. **The backend already exists on Supabase** with users, service_types, time_entries tables. It's missing goals and interested_people tables, and all the settings/profile sync endpoints.

5. **`BackupFile` schema** could serve as the JSON serialization format for the initial data migration from Drive to Supabase.

6. **Service Worker** strategy may need updating if switching from offline-first (IndexedDB) to online-first (direct Supabase).

7. **The `google_tokens` table** in the database is the only purely Drive-specific table. All other tables are useful for Supabase migration.
