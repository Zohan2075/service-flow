---
type: planning
entity: implementation-plan
plan: "drive-refresh-tokens"
phase: 2
status: draft
created: "2026-06-22"
updated: "2026-06-22"
---

# Implementation Plan: Phase 2 - Frontend — Code model + backend integration

> Implements [Phase 2](../phases/phase-2.md) of [drive-refresh-tokens](../plan.md)

## Approach

Replace the GIS token model (`initTokenClient`) with the GIS code model (`initCodeClient`) throughout `GoogleAuthProvider.tsx`. Instead of storing Google access tokens in localStorage, store a **backend JWT** (issued by `POST /api/v1/drive/exchange`) and fetch Google access tokens on-demand from `GET /api/v1/drive/token`. This eliminates token-expiry tracking, the localStorage `StoredDriveSession` machinery, and all popup-based token refresh — auto-sync calls the backend for a fresh Google token with no GIS interaction.

The existing `web/src/lib/api.ts` already implements the three backend API functions (`exchangeDriveCode`, `getDriveToken`, `revokeDriveToken`) matching the Phase 1 contract. This file is correct as-is. The GIS types in `web/src/types/google.d.ts` already declare `CodeClient`, `CodeResponse`, and `initCodeClient` — no changes needed. `web/.env.local` and `web/.env.local.example` already include `NEXT_PUBLIC_API_URL`.

The main work is a targeted refactor of `GoogleAuthProvider.tsx` to swap the auth model while preserving its public context interface (`signIn`, `requestDriveAccess`, `signOut`, `user`, `accessToken`, `hasStoredBackendJwt`). `Providers.tsx` SyncBridge and `Settings` page require minor, mechanical updates to consume `hasStoredBackendJwt` for status display; the `requestDriveAccess` function signatures are unchanged.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `web/src/components/GoogleAuthProvider.tsx` | **rewrite** | Core auth logic: token model → code model, localStorage for backend JWT, new signIn/requestDriveAccess/signOut flows |
| `web/src/components/Providers.tsx` | **minimal modify** | Update SyncBridge `getInteractiveToken` early-return (remove `accessToken` check), Settings status display reference |
| `web/src/app/(dashboard)/settings/page.tsx` | **minimal modify** | Replace `accessToken` status check with `hasStoredBackendJwt` |
| `web/src/lib/api.ts` | **none (verify)** | Already implemented; verify matches Phase 1 contract |
| `web/src/types/google.d.ts` | **none (verify)** | Already has `CodeClient`, `CodeResponse`, `initCodeClient` |
| `web/.env.local` | **none** | Already has `NEXT_PUBLIC_API_URL=http://localhost:8000` |
| `web/.env.local.example` | **none** | Already has `NEXT_PUBLIC_API_URL=your-backend-url` |

## Required Context

| File | Why |
|------|-----|
| `plans/drive-refresh-tokens/plan.md` | Global objective, requirements, Definition of Done |
| `plans/drive-refresh-tokens/phases/phase-2.md` | Gated scope/DoD/acceptance criteria |
| `plans/drive-refresh-tokens/implementation/phase-1-impl.md` | Backend API contract: `POST /exchange` returns `TokenResponse`, `GET /token` returns `DriveTokenResponse({ access_token })`, `DELETE /revoke` returns 204 |
| `web/src/lib/api.ts:1-29` | Already implemented API client — `exchangeDriveCode(code)` → `TokenResponse`, `getDriveToken(jwt)` → `string`, `revokeDriveToken(jwt)` → `void` |
| `web/src/components/GoogleAuthProvider.tsx:1-573` | THE file to refactor — current token-model implementation with `initTokenClient`, `StoredDriveSession`, `requestToken`, `applyTokenResponse` |
| `web/src/components/Providers.tsx:10-27` | `SyncBridge` — wires `getSilentToken`/`getInteractiveToken` to `SyncProvider`; consumes `accessToken` from context |
| `web/src/lib/sync.tsx:1-190` | `SyncProvider` — calls `getSilentToken` for auto-sync, `getInteractiveToken` for manual sync |
| `web/src/lib/drive.ts:1-128` | `uploadBackup(token, json)` / `downloadBackup(token)` — receives Google access token, unchanged |
| `web/src/app/(dashboard)/settings/page.tsx:127` | Imports `{ user, accessToken, ... }` from `useGoogleAuth()`; uses `accessToken` for status display at line 1232 |
| `web/src/app/(dashboard)/settings/page.tsx:349-358` | `ensureDriveAccess()` — calls `signIn()` then `requestDriveAccess({ interactive: true })`, unchanged |
| `web/src/app/login/page.tsx:11` | Imports `{ user, signIn }` from `useGoogleAuth()`; unchanged |
| `web/src/types/google.d.ts:65-87` | `CodeClient`, `CodeResponse`, `initCodeClient` type declarations — already present |
| `web/src/types/data.ts:4-13` | `UserProfile` interface — `google_id`, `name`, `email`, `image` |
| `web/src/lib/store.ts:466-494` | `setProfile(p)` and `signOut()` — store actions used by `GoogleAuthProvider` |
| `web/.env.local:3` | `NEXT_PUBLIC_API_URL=http://localhost:8000` — already present |
| `web/package.json:9-10` | `"lint": "next lint"`, `"type-check": "tsc --noEmit"` — verify commands |

## Implementation Steps

### Step 1: Verify `web/src/lib/api.ts` matches Phase 1 contract

- **What**: Read `web/src/lib/api.ts:1-29`. Confirm `exchangeDriveCode(code)` returns `Promise<{ access_token: string; refresh_token: string }>` matching backend `TokenResponse`. Confirm `getDriveToken(jwt)` returns `Promise<string>` (extracts `access_token` from `DriveTokenResponse`). Confirm `revokeDriveToken(jwt)` returns `Promise<void>` (204 → success, anything else unhandled).
- **Where**: `web/src/lib/api.ts` (read-only verification)
- **Why**: This file already exists with correct implementations. No changes needed, but must be verified against the Phase 1 backend contract before it becomes a dependency of Step 2.
- **Considerations**: `exchangeDriveCode` currently throws on non-2xx responses with a generic message (`"Drive exchange failed: ${res.status}"`). `getDriveToken` similarly throws on non-2xx. The error from `getDriveToken` (e.g. 401 when backend JWT is expired/invalid) must be caught by `requestDriveAccess` to trigger the interactive fallback. The current error format is sufficient — the HTTP status is embedded in the message, but callers in `GoogleAuthProvider` should check for specific conditions (e.g. 401 → re-auth). For now, `requestDriveAccess` will catch any error from `getDriveToken` and treat it as "need to re-auth". This is acceptable; finer-grained status checking can be added later.

### Step 2: Rewrite `GoogleAuthProvider.tsx` — constants, types, and storage helpers

- **What**: 
  1. **Remove** lines 70-218 (the entire `StoredDriveSession` type, `hasDriveScope`, `getGoogleResponseError`, `getGooglePopupError`, `getTokenExpiresAt`, `removeStoredDriveSessionFrom`, `parseStoredDriveSession`, `readStoredDriveSession`, `writeStoredDriveSession`, `clearStoredDriveSession` helpers, and constants `TOKEN_EXPIRY_BUFFER_MS`, `DRIVE_SESSION_STORAGE_KEY`, `DRIVE_SCOPE`).
  2. **Keep** lines 1-19 (imports + `GoogleAuthContextValue` interface), `loadScript` (lines 41-64), `CLIENT_ID` (line 68), `SCOPES` (line 69).
  3. **Add** after line 69:
     ```ts
     const BACKEND_JWT_KEY = "serviceflow-backend-jwt";
     
     function getStoredBackendJwt(): string | null {
       if (typeof window === "undefined") return null;
       try {
         return window.localStorage.getItem(BACKEND_JWT_KEY);
       } catch {
         return null;
       }
     }
     
     function storeBackendJwt(jwt: string) {
       if (typeof window === "undefined") return;
       try {
         window.localStorage.setItem(BACKEND_JWT_KEY, jwt);
       } catch {
         // Ignore storage failures.
       }
     }
     
     function clearStoredBackendJwt() {
       if (typeof window === "undefined") return;
       try {
         window.localStorage.removeItem(BACKEND_JWT_KEY);
       } catch {
         // Ignore storage failures.
       }
     }
     ```
  4. **Update** `GoogleAuthContextValue` interface (lines 16-35): add `hasStoredBackendJwt: boolean` after `isConfigured` (line 27). Keep `accessToken: string | null` (line 20) — now volatile in-memory, set after backend token fetch.
  5. **Update** the `getGooglePopupError` function (lines 90-116): keep but simplify (remove `interactive` parameter since it's now just used for `requestCode` error display). Rename to `getCodePopupError`. Actually, the error callback shape is the same for both token and code clients (`NonOAuthError`), so the popup-error helper logic can stay nearly identical but simplified. Keep only the popup-blocked and popup-closed branches.
- **Where**: `web/src/components/GoogleAuthProvider.tsx` (lines 70-218 delete; lines 16-35 modify; new code after line 69)
- **Why**: Replaces the token-session storage model with a simple backend-JWT storage model. The old localStorage machinery (dual storage fallback, scope validation, expiry checking, Google ID matching) is entirely obsolete because the backend handles refresh internally. The new model is a single key, single value, no expiry tracking.
- **Considerations**: `CLIENT_ID` (line 68) and `SCOPES` (line 69) are retained — they're needed for `initCodeClient`. `SCOPES = "openid profile email https://www.googleapis.com/auth/drive.file"` ensures the ID token is present in the exchanged credentials (needed for `fetchUserInfo` and `google_auth_or_create` on the backend).

### Step 3: Rewrite `GoogleAuthProvider.tsx` — component state and initialization

- **What**: Replace the component state (lines 232-239) and `clearTokenState`/`applyTokenResponse`/`hasUsableDriveToken` (lines 246-268) with new state and helpers:
  1. **Remove**: `accessToken`, `grantedScopes`, `tokenExpiresAt` state variables (lines 233-235).
  2. **Remove**: `tokenClient` state (line 238).
  3. **Remove**: `clearTokenState` (lines 246-251), `applyTokenResponse` (lines 253-264), `hasUsableDriveToken` (lines 266-268).
  4. **Add**:
     ```ts
     const [codeClient, setCodeClient] = useState<google.accounts.oauth2.CodeClient | null>(null);
     const [backendJwt, setBackendJwt] = useState<string | null>(null);
     const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
     ```
  5. **Add** a `useEffect` to initialize `backendJwt` from localStorage on mount:
     ```ts
     useEffect(() => {
       setBackendJwt(getStoredBackendJwt());
     }, []);
     ```
  6. **Replace** `hasUsableDriveToken` with `hasStoredBackendJwt`:
     ```ts
     const hasStoredBackendJwt = Boolean(backendJwt);
     ```
  7. **Keep**: `user`, `isLoading`, `error`, `isConfigured`, `storeProfile`, `storeGoogleId`.
- **Where**: `web/src/components/GoogleAuthProvider.tsx` (around lines 232-268)
- **Why**: The new state tracks what matters in the code model: the `codeClient` (initialized from GIS), the `backendJwt` (persisted in localStorage, used to authenticate with the backend), and `googleAccessToken` (volatile in-memory cache for the last-fetched Google token, mapped to the public `accessToken` context value for backward compatibility).

### Step 4: Rewrite `GoogleAuthProvider.tsx` — `ensureTokenClient` → `ensureCodeClient`

- **What**: Replace `ensureTokenClient` (lines 270-309) with `ensureCodeClient`:
  ```ts
  const ensureCodeClient = useCallback(async () => {
    if (!CLIENT_ID) {
      const message = "Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app.";
      setError(message);
      setIsLoading(false);
      throw new Error(message);
    }
    if (codeClient) return codeClient;
    setIsLoading(true);
    try {
      await loadScript("https://accounts.google.com/gsi/client");
      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) throw new Error("Google sign-in failed to initialize");
      const cc = oauth.initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: "postmessage",
        callback: () => {},
      });
      setCodeClient(cc);
      setError(null);
      return cc;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Google sign-in";
      setError(message);
      console.error("Failed to initialize Google Identity Services", err);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [codeClient]);
  ```
- **Where**: Replaces lines 270-309 in `web/src/components/GoogleAuthProvider.tsx`
- **Why**: Swaps `initTokenClient` for `initCodeClient`. Key difference: `initCodeClient` requires `redirect_uri: "postmessage"` for the popup flow (per Phase 1 Notes and GIS docs). The `codeClient.requestCode()` method opens the popup and delivers a `CodeResponse({ code, scope })` to the callback — no `prompt` parameter, no access token in the response.
- **Considerations**: The GIS script URL is the same (`https://accounts.google.com/gsi/client`). The `scope` parameter is still required and must include `https://www.googleapis.com/auth/drive.file` for the refresh token to have Drive access. The `callback` placeholder (`() => {}`) is replaced at call time by `requestCode` (Step 5), same pattern as the current `requestToken`.

### Step 5: Rewrite `GoogleAuthProvider.tsx` — `requestToken` → `requestCode`

- **What**: Replace `requestToken` (lines 311-365) with `requestCode`:
  ```ts
  const requestCode = useCallback(async (): Promise<google.accounts.oauth2.CodeResponse> => {
    const client = await ensureCodeClient();
    return new Promise<google.accounts.oauth2.CodeResponse>((resolve, reject) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const rejectWith = (message: string) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        client.error_callback = undefined;
        reject(new Error(message));
      };
      const resolveWith = (resp: google.accounts.oauth2.CodeResponse) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        client.error_callback = undefined;
        resolve(resp);
      };
      timeoutId = setTimeout(() => {
        rejectWith("Google sign-in timed out. Please try again.");
      }, 15_000);
      client.callback = (resp) => {
        if (resp.error) {
          rejectWith(resp.error_description ?? resp.error ?? "Google sign-in failed");
          return;
        }
        resolveWith(resp);
      };
      client.error_callback = (error) => {
        rejectWith(getGooglePopupError(error, "Google sign-in was cancelled.", true));
      };
      client.requestCode();
    });
  }, [ensureCodeClient]);
  ```
- **Where**: Replaces lines 311-365 in `web/src/components/GoogleAuthProvider.tsx`
- **Why**: `requestToken` was built around `client.requestAccessToken({ prompt })` returning a `TokenResponse`. The code model uses `client.requestCode()` (no prompt parameter) returning a `CodeResponse({ code, scope })`. The Promise wrapper pattern (settled flag, timeout, callback/error_callback swap) is identical; only the client method, response type, and error handling differ.
- **Considerations**: `requestCode()` does NOT accept a `prompt` parameter — the popup behavior (account selection, consent) is controlled by the user's Google session state. The first call always shows account selection + consent (needed for refresh token). Subsequent calls may auto-select if the user is still signed in. The 15s timeout is retained from the current implementation. The `NonOAuthError` (`popup_failed_to_open`, `popup_closed`) handling is preserved via `getGooglePopupError`.

### Step 6: Rewrite `GoogleAuthProvider.tsx` — `signIn` function

- **What**: Replace `signIn` (lines 450-466) with the code-model flow:
  ```ts
  const signIn = useCallback(async () => {
    setError(null);
    try {
      // 1. Open GIS code popup → get auth code
      const codeResp = await requestCode();
      
      // 2. Exchange code with backend → get backend JWT
      const tokenResp = await exchangeDriveCode(codeResp.code);
      
      // 3. Store backend JWT
      storeBackendJwt(tokenResp.access_token);
      setBackendJwt(tokenResp.access_token);
      
      // 4. Get a Google access token from backend
      const googleToken = await getDriveToken(tokenResp.access_token);
      setGoogleAccessToken(googleToken);
      
      // 5. Fetch user profile using the Google access token
      await fetchUserInfo(googleToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      throw new Error(message);
    }
  }, [requestCode, fetchUserInfo]);
  ```
- **Where**: Replaces lines 450-466 in `web/src/components/GoogleAuthProvider.tsx`
- **Why**: The old flow was: GIS popup → `TokenResponse.access_token` → `applyTokenResponse` (store in localStorage) → `fetchUserInfo(access_token)`. The new flow is: GIS popup → `CodeResponse.code` → backend `POST /exchange` → store backend JWT → backend `GET /token` → Google access token → `fetchUserInfo(googleToken)`. The Google access token is never stored persistently; it's fetched on-demand via the backend.
- **Considerations**: The backend JWT from `exchangeDriveCode` is `tokenResp.access_token` (per Phase 1 backend contract — the `/exchange` endpoint returns the existing `TokenResponse` schema which has `access_token` and `refresh_token` fields). The backend `access_token` is the JWT used for subsequent backend API calls (NOT a Google token). The backend `refresh_token` is currently unused by the frontend (the backend handles Google refresh internally), but is returned in the response. We only store the `access_token` (backend JWT). `fetchUserInfo` (lines 377-398) is unchanged — it calls `https://www.googleapis.com/oauth2/v3/userinfo` with the Google access token to get `{ sub, name, email, picture }`.

### Step 7: Rewrite `GoogleAuthProvider.tsx` — `requestDriveAccess` function

- **What**: Replace `requestDriveAccess` (lines 469-540) with:
  ```ts
  const requestDriveAccess = useCallback(async (options?: { interactive?: boolean }): Promise<string> => {
    const interactive = options?.interactive ?? true;
    
    // Silent path: use stored backend JWT to get a fresh Google token from backend
    const trySilent = async (): Promise<string> => {
      const jwt = backendJwt ?? getStoredBackendJwt();
      if (!jwt) {
        throw new Error(
          user
            ? "Google Drive connection lost. Reconnect Drive to continue syncing."
            : "Sign in with Google again to continue Drive sync."
        );
      }
      const googleToken = await getDriveToken(jwt);
      setGoogleAccessToken(googleToken);
      return googleToken;
    };
    
    // Interactive fallback: code model popup → exchange → store → get token
    const tryInteractive = async (): Promise<string> => {
      const codeResp = await requestCode();
      const tokenResp = await exchangeDriveCode(codeResp.code);
      storeBackendJwt(tokenResp.access_token);
      setBackendJwt(tokenResp.access_token);
      const googleToken = await getDriveToken(tokenResp.access_token);
      setGoogleAccessToken(googleToken);
      if (!user) {
        await fetchUserInfo(googleToken);
      }
      setError(null);
      return googleToken;
    };
    
    try {
      return await trySilent();
    } catch (silentErr) {
      if (!interactive) {
        throw silentErr;
      }
      // Interactive fallback: open popup for re-authorization
      try {
        return await tryInteractive();
      } catch (interactiveErr) {
        const message = interactiveErr instanceof Error ? interactiveErr.message : "Google Drive authorization failed";
        setError(message);
        throw new Error(message);
      }
    }
  }, [backendJwt, fetchUserInfo, requestCode, user]);
  ```
- **Where**: Replaces lines 469-540 in `web/src/components/GoogleAuthProvider.tsx`
- **Why**: 
  - `{ interactive: false }`: Reads the backend JWT from state (or localStorage if state not yet hydrated), calls `getDriveToken(jwt)` on the backend, returns the Google access token. No GIS calls, no popups. This is the auto-sync path.
  - `{ interactive: true }`: Tries silent first (same as above). If that fails (no backend JWT, JWT expired, refresh token revoked), falls back to a code-model popup, exchanges the code, stores the new backend JWT, fetches a Google token, and (if user profile missing) fetches user info.
  - The Google access token is cached in `googleAccessToken` state (volatile, in-memory) for the `accessToken` context value.
- **Considerations**: `trySilent` checks both `backendJwt` (state) and `getStoredBackendJwt()` (localStorage) because on mount, `backendJwt` state might not be hydrated yet if the `useEffect` hasn't run. `tryInteractive` mirrors the signIn flow but skips `fetchUserInfo` if `user` already exists (the user is re-authorizing Drive, not signing in). Error from `getDriveToken` (e.g. 401 → refresh token revoked) triggers the interactive fallback. The `setError(null)` call on success clears any previous auth errors.

### Step 8: Rewrite `GoogleAuthProvider.tsx` — `signOut` function

- **What**: Replace `signOutHandler` (lines 543-548) with:
  ```ts
  const signOutHandler = useCallback(() => {
    // Best-effort: tell backend to revoke the refresh token
    const jwt = backendJwt ?? getStoredBackendJwt();
    if (jwt) {
      revokeDriveToken(jwt).catch(() => {
        // Ignore — we're signing out regardless.
      });
    }
    window.google?.accounts?.id?.disableAutoSelect();
    clearStoredBackendJwt();
    setBackendJwt(null);
    setGoogleAccessToken(null);
    storeSignOut();
  }, [backendJwt, storeSignOut]);
  ```
- **Where**: Replaces lines 543-548 in `web/src/components/GoogleAuthProvider.tsx`
- **Why**: Attempts to revoke the backend refresh token (best-effort, fire-and-forget), then clears all local state: backend JWT from localStorage, component state, and zustand store (via `storeSignOut()` — which clears profile, settings, service types, entries, goals, sync state).
- **Considerations**: `signOut` in the context interface is `() => void`, so we fire-and-forget the async `revokeDriveToken` call. The `window.google?.accounts?.id?.disableAutoSelect()` call is retained for cleanup, though it's primarily for the old One Tap API; it's harmless to keep.

### Step 9: Rewrite `GoogleAuthProvider.tsx` — remove stale storage effects, add backend JWT hydration

- **What**: Remove the two `useEffect` blocks that manage `StoredDriveSession` persistence (lines 400-447). Remove the `useEffect` that reads stored session and syncs to state (lines 400-429). Remove the `useEffect` that writes access token changes to storage (lines 431-447).
  
  Keep the mount-time GIS initialization `useEffect` (lines 368-374) but update it to call `ensureCodeClient` instead of `ensureTokenClient`:
  ```ts
  useEffect(() => {
    let mounted = true;
    ensureCodeClient().catch(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [ensureCodeClient]);
  ```
  
  Add a hydration `useEffect` to restore `backendJwt` from localStorage on mount (already covered in Step 3's state init).
  
  Keep the store → local reactive state sync `useEffect` (lines 242-244) unchanged.
- **Where**: `web/src/components/GoogleAuthProvider.tsx` (lines 400-447 delete; lines 368-374 modify)
- **Why**: The two localStorage synchronization effects are no longer needed because we no longer persist Google access tokens (only the backend JWT, which is set/cleared explicitly in `signIn`/`signOut`/`requestDriveAccess`).

### Step 10: Update `GoogleAuthProvider.tsx` — context value provider

- **What**: Update the JSX context provider (lines 550-565) to expose the new state:
  ```tsx
  <GoogleAuthContext.Provider
    value={{
      user,
      accessToken: googleAccessToken,
      isLoading,
      isReady: !isLoading,
      isConfigured,
      hasStoredBackendJwt,
      error,
      signIn,
      requestDriveAccess,
      signOut: signOutHandler,
    }}
  >
    {children}
  </GoogleAuthContext.Provider>
  ```
- **Where**: `web/src/components/GoogleAuthProvider.tsx` (lines 550-565)
- **Why**: `accessToken` now maps to the volatile `googleAccessToken` state (null until first token fetch from backend). `hasStoredBackendJwt` is the new boolean for consumers to check Drive connectivity. All function references (`signIn`, `requestDriveAccess`, `signOut`) are updated by Steps 6-8.

### Step 11: Update `Providers.tsx` SyncBridge

- **What**: Two changes:
  1. Add `hasStoredBackendJwt` to the destructured context values (for passing to children, or just import — not needed directly).
  2. **Change** `getInteractiveToken` (lines 13-16) to remove the `accessToken` early-return optimization:
     ```tsx
     const getInteractiveToken = useCallback(async () => {
       return requestDriveAccess({ interactive: true });
     }, [requestDriveAccess]);
     ```
     Formerly:
     ```tsx
     const getInteractiveToken = useCallback(async () => {
       if (accessToken) return accessToken;
       return requestDriveAccess({ interactive: true });
     }, [accessToken, requestDriveAccess]);
     ```
  The `accessToken` early-return is removed because the Google access token is now volatile in-memory with no expiry tracking — a cached `accessToken` could be stale. `requestDriveAccess({ interactive: true })` will try the silent backend path first, then fall back to popup only if needed, so the cost of always calling it is at most one fast backend HTTP request.
  
  `getSilentToken` (lines 18-20) is unchanged — it already calls `requestDriveAccess({ interactive: false })` which always hits the backend for a fresh token.
- **Where**: `web/src/components/Providers.tsx:11-20`
- **Why**: The `accessToken` early-return was an optimization in the old model where `accessToken` had known expiry. In the new model, `googleAccessToken` is a best-effort cache without expiry knowledge. Removing the early-return ensures manual sync always gets a fresh token. The backend call is cheap (sub-2-second NFR per plan), and `requestDriveAccess({ interactive: true })` queries the backend silently before falling back to a popup, so no unnecessary popups are triggered.
- **Considerations**: If this change is considered too aggressive, the early-return can be kept — `uploadBackup` handles 401 errors from Drive API gracefully. But removing it is safer and aligns with the plan NFR of "no popups after initial authorization."

### Step 12: Update Settings page status display

- **What**: In `web/src/app/(dashboard)/settings/page.tsx`:
  1. Line 127: Add `hasStoredBackendJwt` to the destructured context values:
     ```tsx
     const { user, accessToken, isLoading: googleLoading, isConfigured, error: googleError, hasStoredBackendJwt, requestDriveAccess, signIn } = useGoogleAuth();
     ```
  2. Line 1232-1248: Replace `accessToken` checks with `hasStoredBackendJwt` in the Drive connection status display:
     ```tsx
     // OLD (line 1232):
     {!user ? "account_circle" : accessToken ? "cloud_done" : "cloud_sync"}
     // NEW:
     {!user ? "account_circle" : hasStoredBackendJwt ? "cloud_done" : "cloud_sync"}
     
     // OLD (line 1238):
     {!user ? t("settings.notSignedIn") : accessToken ? t("settings.driveConnected") : t("settings.driveNotConnected")}
     // NEW:
     {!user ? t("settings.notSignedIn") : hasStoredBackendJwt ? t("settings.driveConnected") : t("settings.driveNotConnected")}
     
     // OLD (line 1244):
     accessToken ? t("settings.driveReady") : t("settings.connectDriveOnce")
     // NEW:
     hasStoredBackendJwt ? t("settings.driveReady") : t("settings.connectDriveOnce")
     ```
- **Where**: `web/src/app/(dashboard)/settings/page.tsx:127` (import line), `web/src/app/(dashboard)/settings/page.tsx:1232-1248` (status display)
- **Why**: `accessToken` in the new model is a transient cache (could be null while `backendJwt` is valid). `hasStoredBackendJwt` is the authoritative indicator of Drive connectivity. The status display should show "connected" when the user has a stored backend JWT (meaning they can fetch Google tokens on-demand), not just when a Google token happens to be in memory.
- **Considerations**: `ensureDriveAccess` (lines 349-358) and `handleDriveBackup`/`handleDriveRestore` (lines 361-405) are unchanged — they call `requestDriveAccess({ interactive: true })` which now uses the code model + backend internally.

### Step 13: Verify `google.d.ts` has all needed types

- **What**: Confirm `web/src/types/google.d.ts:65-87` declares:
  - `CodeResponse` interface with `code: string`, `scope: string`, `error?`, `error_description?`
  - `CodeClient` interface with `callback`, `error_callback?`, `requestCode()`
  - `initCodeClient` function with `client_id`, `scope`, `redirect_uri?`, `callback`, `error_callback?`
- **Where**: `web/src/types/google.d.ts:65-87` (read-only verification)
- **Why**: These types are used by `ensureCodeClient` (Step 4) and `requestCode` (Step 5). They are already present and correct. The `NonOAuthError` type (used by `error_callback`) is shared with the token model (`google.accounts.oauth2.NonOAuthError` at lines 38-40) — no change needed.
- **Considerations**: The `initCodeClient` config may support additional fields not declared (`ux_mode`, `select_account`, `hint`, `state`). For Phase 2, only `client_id`, `scope`, `redirect_uri` are needed. No type extensions are required.

### Step 14: Final integration self-check

- **What**: Walk through each acceptance criterion from [Phase 2](../phases/phase-2.md#acceptance-criteria) and confirm the code path:
  1. **Fresh sign-in**: `Login page → signIn()` → `requestCode()` (GIS popup) → `exchangeDriveCode(code)` → store `backendJwt` → `getDriveToken(backendJwt)` → `fetchUserInfo(googleToken)` → profile in store ✅
  2. **`requestDriveAccess({ interactive: false })` returns Google token**: `getSilentToken` → `requestDriveAccess({ interactive: false })` → `trySilent()` → `getStoredBackendJwt()` → `getDriveToken(jwt)` → returns Google token ✅
  3. **Auto-sync 30s debounce**: `SyncProvider.autoSync` → `getSilentToken()` → (same as #2) → `uploadBackup(token, json)` ✅
  4. **Reopen PWA**: On mount, `useEffect` hydrates `backendJwt` from localStorage → auto-sync fires → `getSilentToken()` → backend → fresh Google token → sync ✅
  5. **Manual Backup/Drive**: `Settings.ensureDriveAccess()` → `requestDriveAccess({ interactive: true })` → tries silent → if fails, `tryInteractive()` → code popup → exchange → store → getDriveToken → return ✅
  6. **Sign out**: `signOut()` → `revokeDriveToken(backendJwt)` (fire-and-forget) → `clearStoredBackendJwt()` → `storeSignOut()` ✅
  7. **Existing user migration**: `storeProfile` exists → `backendJwt` is null → user sees local data → first manual sync triggers interactive popup → backend JWT stored → subsequent syncs silent ✅
  8. **`npm run lint` + `npm run type-check` pass**: Run the verify commands (see Testing Plan) ✅
- **Where**: Cross-file mental walkthrough — no code changes in this step.
- **Why**: Catches integration gaps before implementation. The walkthrough confirms all data flows are complete and no intermediate changes are needed in `sync.tsx`, `drive.ts`, `login/page.tsx`, or the store.

## Testing Plan

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| TypeScript | `npm run type-check` (from `web/`) | No type errors. `CodeClient`, `CodeResponse`, `initCodeClient` resolve from `google.d.ts`. API client return types match usage. |
| Lint | `npm run lint` (from `web/`) | No lint errors. No unused imports (the old helpers are removed). |
| Sign-in (manual) | Start dev server, visit `/login`, click "Continue with Google" | One popup opens → backend exchange → user redirected to `/calendar` with profile loaded. No popup after redirect. |
| Auto-sync (manual) | Make an edit, wait 30s, check console | `[ServiceFlow] Auto-sync starting` → `[ServiceFlow] Auto-sync succeeded`. No popup. |
| Reopen (manual) | Close browser tab, reopen the PWA | Auto-sync fires on open (console log), completes without popup. |
| Settings backup (manual) | Go to Settings → Data → "Backup to Drive" | If backend JWT present: fast, no popup. If backend JWT absent: one popup for re-auth, then backup succeeds. |
| Settings restore (manual) | "Restore from Drive" | Same as backup — silent if JWT present, one popup if not. |
| Sign out (manual) | Sign out from profile | Backend JWT cleared from localStorage. Drive token revoked on backend. |
| Existing user (manual) | Pre-condition: old-style sign-in with `storeProfile` in IndexedDB and `DRIVE_SESSION_STORAGE_KEY` in localStorage. Deploy new code. | User sees their data (profile loaded from store). Drive status shows "not connected". First manual backup triggers one code-model popup. After that, auto-sync works silently. |

### Primary verify command

```powershell
cd web; npm run type-check; if ($?) { npm run lint }
```

This exercises the real TypeScript compilation and ESLint rules against all changed files. It catches type mismatches, missing imports, unused variables, and structural errors in the refactored code. The command does **not** require a running backend or Google OAuth client — it validates code correctness in isolation.

Full end-to-end testing (actual Google sign-in, backend exchange, auto-sync) requires:
- Backend running at `NEXT_PUBLIC_API_URL` (Phase 1 complete + locally running)
- A real Google OAuth client configured for code model with `redirect_uri=postmessage`
- A browser with a Google account

These prerequisites are satisfied after Phase 1 + Phase 3 setup, but Phase 2 can be type-checked and linted independently.

### Test Integrity Constraints

- **No existing tests are affected.** The frontend (like the backend) has **no test suite** — verified via glob: no `web/src/**/*.test.*`, no `web/src/**/*.spec.*`, no `web/__tests__/`, no `vitest.config.*`, no `jest.config.*`. No existing tests can be disabled, deleted, or weakened.
- **The following existing behaviors must not be broken by Phase 2 changes:**
  - The Login page's `signIn()` call and redirect-on-auth behavior.
  - The Settings page's `ensureDriveAccess()` → `requestDriveAccess({ interactive: true })` call — the function signature is preserved, but the implementation changes from token-model popup to code-model popup + backend exchange. The caller (`handleDriveBackup`, `handleDriveRestore`) receives a Google access token `string` as before.
  - `SyncProvider`'s `getSilentToken` and `getInteractiveToken` function signatures — unchanged. `SyncProvider` calls `getSilentToken()` (no args) and expects a `Promise<string>` for the Google access token. This contract is preserved.
  - `uploadBackup(token, json)` and `downloadBackup(token)` — unchanged. They receive a Google access token `string` and call the Drive REST API. The token source (old: GIS directly; new: backend) is transparent to them.
  - The `useGoogleAuth()` hook's public interface preserves `user`, `accessToken`, `isLoading`, `isReady`, `isConfigured`, `error`, `signIn()`, `requestDriveAccess()`, `signOut()`. The new `hasStoredBackendJwt` field is additive.
  - Zustand store (`setProfile`, `signOut`, `settings.autoSync`, `syncMetadata`) — unchanged. The store is not touched by Phase 2.
- **LocalStorage migration**: The old `DRIVE_SESSION_STORAGE_KEY` key is no longer written by the new code but will remain in users' localStorage until they clear it or sign-out-via-old-code. This is harmless: the new code ignores this key. The new `BACKEND_JWT_KEY` key is additive and does not collide.
- **GIS script**: The same `https://accounts.google.com/gsi/client` script is loaded. The code model and token model APIs are in the same script, so no additional script loads are needed.

## Rollback Strategy

1. **Revert code**: `git revert` the Phase 2 commit (or `git restore` the affected files if uncommitted). The changes are confined to:
   - `web/src/components/GoogleAuthProvider.tsx` (major rewrite)
   - `web/src/components/Providers.tsx` (2 lines changed in `getInteractiveToken`)
   - `web/src/app/(dashboard)/settings/page.tsx` (import + 3 lines in status display)
2. **No DB changes**: Phase 2 makes no backend changes, no migrations, no schema modifications.
3. **Frontend-only rollback**: Revert the frontend files. The backend endpoints remain (they can coexist — the old frontend won't call them). If the backend Phase 1 was also deployed, the `google_tokens` table and `/drive/*` endpoints can remain without harm.
4. **No data loss risk**: The only new data stored is the `BACKEND_JWT_KEY` in localStorage. Rolling back the frontend means the old code will ignore this key and look for `DRIVE_SESSION_STORAGE_KEY` instead. Users who signed in via the new flow will have no `DRIVE_SESSION_STORAGE_KEY` and will need to sign in again — a one-time inconvenience, no permanent data loss.
5. **Migration reversal**: If users signed in via the new flow before rollback, their backend `google_tokens` row exists. After frontend rollback, this row is unused (orphaned). It can be cleaned up later or left as-is — it has no effect on the old token-model frontend.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Should `getInteractiveToken` keep the `accessToken` early-return? | (a) Remove it (always call `requestDriveAccess`), (b) Keep it (use cached `googleAccessToken`) | (a) Remove it | `googleAccessToken` is volatile with no expiry tracking — a stale token would fail at the Drive API level with a 401, which the user would see as an error. Calling `requestDriveAccess({ interactive: true })` hits the backend silently first (fast, sub-2s), so the cost of removal is minimal. This avoids a class of stale-token bugs. |
| Should `signOut` await `revokeDriveToken`? | (a) Fire-and-forget, (b) Await with timeout | (a) Fire-and-forget | The `signOut` context method is typed as `() => void`. Making it async would break the public interface. The revoke is best-effort (the backend JWT expires naturally anyway). If the revoke call hangs, we don't want to block the user from signing out. |
| Should the `accessToken` context field be kept or removed? | (a) Keep as volatile cache, (b) Remove entirely | (a) Keep | Multiple consumers reference `accessToken` (SyncBridge for early-return, Settings for status display). Keeping it minimizes diff surface. The value is set after successful `getDriveToken` calls and cleared on signOut. Even though SyncBridge no longer uses it for early-return (per decision above), the Settings status display uses `hasStoredBackendJwt` instead, but keeping `accessToken` avoids breaking other potential consumers. |
| Should we add `select_account: true` to `initCodeClient` config? | (a) No — default behavior, (b) Yes — force account selection every time | (a) No | The default code-model popup behavior already shows account selection when the user isn't signed in or has multiple accounts. Forcing it would add friction to re-auth flows (manual backup). If needed, it can be added via a separate `initCodeClient` instance for sign-in vs. re-auth. |
| Which backend JWT field to store? | (a) `access_token` only, (b) both `access_token` and `refresh_token` | (a) `access_token` only | The backend `/exchange` endpoint returns `TokenResponse { access_token, refresh_token }` where both are backend JWTs (the `access_token` is for authenticating API calls, the `refresh_token` is for obtaining a new `access_token` when it expires). For Phase 2, we only need the `access_token` (which is the Bearer token for `GET /token` and `DELETE /revoke`). The backend JWT's own expiry/refresh is a future concern; for now, a single stored JWT is sufficient. If the backend JWT expires, `getDriveToken` returns 401, and the interactive path re-exchanges via a new code popup. |
| Should `googleAccessToken` have a TTL or be set to null after a timeout? | (a) No TTL — just cache until next fetch, (b) Set 50-minute TTL to avoid stale use | (a) No TTL | The only direct consumer of `accessToken` after Step 11 is the Settings status display (which now uses `hasStoredBackendJwt` instead). `googleAccessToken` is effectively a debug/logging convenience. If future code reads `accessToken` and uses it directly, it would get whatever was last fetched — and the Drive API would reject it with 401 if stale, which is handled by `parseDriveError` in `drive.ts`. Adding a TTL is premature optimization. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `web/src/lib/api.ts:1-29` | `exchangeDriveCode`, `getDriveToken`, `revokeDriveToken` | Already-implemented API client — gating dependency for Step 2+ |
| `web/src/components/GoogleAuthProvider.tsx:16-35` | `GoogleAuthContextValue` interface | Public API that must be preserved; `hasStoredBackendJwt` is additive |
| `web/src/components/GoogleAuthProvider.tsx:68-69` | `CLIENT_ID`, `SCOPES` constants | Retained for `initCodeClient`; scopes must include `drive.file` |
| `web/src/components/GoogleAuthProvider.tsx:70-218` | `StoredDriveSession`, `hasDriveScope`, storage helpers | Entire block to be removed — obsolete token-session model |
| `web/src/components/GoogleAuthProvider.tsx:270-309` | `ensureTokenClient` | Replaced by `ensureCodeClient` with `initCodeClient` + `redirect_uri: "postmessage"` |
| `web/src/components/GoogleAuthProvider.tsx:311-365` | `requestToken` | Replaced by `requestCode` with `client.requestCode()` returning `CodeResponse` |
| `web/src/components/GoogleAuthProvider.tsx:377-398` | `fetchUserInfo` | Unchanged — still calls Google `userinfo` endpoint with a Google access token |
| `web/src/components/GoogleAuthProvider.tsx:400-447` | Storage sync effects | Removed — no more localStorage token synchronization |
| `web/src/components/GoogleAuthProvider.tsx:450-466` | `signIn` | Rewired: code popup → backend exchange → store JWT → get token → fetch user |
| `web/src/components/GoogleAuthProvider.tsx:469-540` | `requestDriveAccess` | Rewired: silent path hits backend; interactive falls back to code popup |
| `web/src/components/GoogleAuthProvider.tsx:543-548` | `signOutHandler` | Enhanced: revoke backend token + clear backend JWT |
| `web/src/components/GoogleAuthProvider.tsx:550-565` | Context provider JSX | Updated to expose `hasStoredBackendJwt` and map `accessToken` to `googleAccessToken` |
| `web/src/components/Providers.tsx:11-20` | `SyncBridge` `getInteractiveToken` | Remove `accessToken` early-return for safety |
| `web/src/app/(dashboard)/settings/page.tsx:127` | `useGoogleAuth()` destructure | Add `hasStoredBackendJwt` |
| `web/src/app/(dashboard)/settings/page.tsx:1232-1248` | Drive status display | Switch from `accessToken` to `hasStoredBackendJwt` |
| `web/src/types/google.d.ts:65-87` | `CodeClient`, `CodeResponse`, `initCodeClient` | Already present — verified, no changes needed |
| `web/.env.local:3` | `NEXT_PUBLIC_API_URL=http://localhost:8000` | Already present — verified |
| `web/.env.local.example:3` | `NEXT_PUBLIC_API_URL=your-backend-url` | Already present — verified |
| `web/package.json:9-10` | `lint`, `type-check` scripts | Verify commands to run after implementation |

### Mismatches / Notes

- **`lib/api.ts` is not empty.** The task description states this file is "currently empty" but it actually contains a complete implementation of `exchangeDriveCode`, `getDriveToken`, and `revokeDriveToken` (29 lines, last commit includes this file). The API client matches the Phase 1 backend contract exactly: `POST /exchange` returns `{ access_token, refresh_token }`, `GET /token` returns `{ access_token }` (extracted), `DELETE /revoke` returns void. No changes needed — Step 1 is a verification-only step. The mismatch is in the scaffolding prompt, not in the code.
- **`google.d.ts` already has `initCodeClient` types.** Lines 65-87 declare `CodeResponse`, `CodeClient`, `requestCode`, and `initCodeClient`. Phase 2 deliverables say "update if needed" — no update is needed. Verified.
- **`.env.local.example` already has `NEXT_PUBLIC_API_URL`.** Line 3 reads `NEXT_PUBLIC_API_URL=your-backend-url`. Phase 2 deliverable says "updated with NEXT_PUBLIC_API_URL" — it's already present. No change needed.
- **`SCOPES` constant includes `drive.file` scope at sign-in time.** This means the user will see the Drive access consent screen during the very first sign-in. This is intentional: it ensures the refresh token (obtained server-side via `flow.fetch_token`) includes `drive.file` scope. Without it, the refresh token would only cover `openid profile email`, and `GET /token` would return a Google access token without Drive access. The backend Phase 1 implementation explicitly requests `drive.file` scope in `exchange_auth_code` (phase-1-impl.md Step 6), and the scopes must match between the frontend code request and the backend exchange.
- **`redirect_uri: "postmessage"` is critical.** The `initCodeClient` config must include `redirect_uri: "postmessage"` for the popup flow. The backend's `exchange_auth_code` also uses `"postmessage"` as the redirect URI (phase-1-impl.md Step 6). If these don't match, Google will reject the exchange with a `redirect_uri_mismatch` error. Both sides use `"postmessage"` — verified.
- **No test suite exists.** Like the backend, the frontend has no test files (no `*.test.*`, no `*.spec.*`, no `__tests__/`, no test runner config). The verify command (`npm run type-check && npm run lint`) provides static analysis but no runtime behavior verification. Full E2E testing requires a running backend + Google OAuth client and must be done manually (per plan's Testing Strategy).
- **Backend JWT expiry is not handled.** The Phase 2 frontend stores the backend JWT indefinitely. If the backend JWT expires (per the backend's `create_access_token` with a finite expiry), `GET /drive/token` will return 401. The `requestDriveAccess` interactive fallback handles this by initiating a new code-model popup, which re-authenticates the user and obtains a new backend JWT. This is the intended recovery path and matches the plan's risk mitigation: "Backend returns 401 → frontend prompts for re-authorization." However, the user experience is a popup appearing during auto-sync — suboptimal but acceptable per plan.
- **Settings page already uses `accessToken` in a second location.** Line 464 defines `isDriveBusy` which does NOT use `accessToken` (it uses `driveLoading || googleLoading || sync.status === "syncing"`). Lines 1233, 1238, 1244 use `accessToken` for display only. The change to `hasStoredBackendJwt` in Step 12 covers all usage. Additionally, line 1228 reads `accessToken` from the context value — this destructure is at line 127, which already includes `accessToken`. After Step 12, both `accessToken` and `hasStoredBackendJwt` are destructured; the former is kept for backward compatibility (not used in new code paths). This is safe.
- **`getGooglePopupError` is simplified in Step 2.** The current version accepts `interactive: boolean` and varies messages. The code model version always treats popup errors as interactive (since `requestCode()` always opens a popup visible to the user). The silent path no longer involves GIS at all. The simplified helper is fine.

