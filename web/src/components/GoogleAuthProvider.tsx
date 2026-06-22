"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import type { UserProfile } from "@/types/data";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoogleAuthContextValue {
  /** Current signed-in user profile (null = not signed in) */
  user: UserProfile | null;
  /** Access token for Google APIs (Drive). Null until user grants consent. */
  accessToken: string | null;
  /** true while GIS script is loading */
  isLoading: boolean;
  /** true once auth initialization has completed for this page load */
  isReady: boolean;
  /** whether the app has a Google OAuth client id configured */
  isConfigured: boolean;
  /** configuration or runtime auth error to show in the UI */
  error: string | null;
  /** Trigger Google sign-in popup (also grants Drive access) */
  signIn: () => Promise<void>;
  /** Request Drive access token. Interactive mode may open a popup. */
  requestDriveAccess: (options?: { interactive?: boolean }) => Promise<string>;
  /** Sign out and clear profile */
  signOut: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      const handleLoad = () => resolve();
      const handleError = () => reject(new Error(`Failed to load script: ${src}`));
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener("error", handleError, { once: true });
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

// ─── Provider ────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPES = "openid profile email https://www.googleapis.com/auth/drive.file";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const DRIVE_SESSION_STORAGE_KEY = "serviceflow-google-drive-session";

type StoredDriveSession = {
  accessToken: string;
  grantedScopes: string | null;
  tokenExpiresAt: number | null;
  googleId: string | null;
};

function hasDriveScope(scope: string | null | undefined) {
  if (!scope) return false;
  return scope.split(/\s+/).includes(DRIVE_SCOPE);
}

function getGoogleResponseError(resp: google.accounts.oauth2.TokenResponse) {
  return resp.error_description ?? resp.error ?? null;
}

function getGooglePopupError(
  error: google.accounts.oauth2.NonOAuthError | undefined,
  fallbackMessage: string,
  interactive: boolean
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "this origin";
  const isLocalOrigin = typeof window !== "undefined"
    ? ["localhost", "127.0.0.1"].includes(window.location.hostname)
    : false;

  switch (error?.type) {
    case "popup_failed_to_open":
      return interactive
        ? "Google sign-in popup was blocked by the browser. Allow popups for this site and try again."
        : "Google Drive session could not be refreshed in the background. Reconnect Drive to continue syncing.";
    case "popup_closed":
      if (interactive && isLocalOrigin) {
        return `Google sign-in could not complete. If Google showed redirect_uri_mismatch, add ${origin} to the OAuth client's Authorized JavaScript origins in Google Cloud Console, then try again.`;
      }

      return interactive
        ? "Google sign-in was cancelled before it completed."
        : "Google Drive session refresh was cancelled before it completed.";
    default:
      return fallbackMessage;
  }
}

function getTokenExpiresAt(expiresIn?: number) {
  if (!expiresIn) return null;
  return Date.now() + Math.max(0, expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS);
}

function removeStoredDriveSessionFrom(storage: Storage | undefined) {
  if (!storage) return;

  try {
    storage.removeItem(DRIVE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures and fall back to runtime auth state.
  }
}

function parseStoredDriveSession(raw: string, expectedGoogleId?: string): StoredDriveSession | null {
  const parsed = JSON.parse(raw) as Partial<StoredDriveSession>;

  if (!parsed.accessToken || typeof parsed.accessToken !== "string") {
    return null;
  }

  if (expectedGoogleId && parsed.googleId && parsed.googleId !== expectedGoogleId) {
    return null;
  }

  const tokenExpiresAt =
    typeof parsed.tokenExpiresAt === "number" ? parsed.tokenExpiresAt : null;

  if (tokenExpiresAt && tokenExpiresAt <= Date.now()) {
    return null;
  }

  return {
    accessToken: parsed.accessToken,
    grantedScopes: typeof parsed.grantedScopes === "string" ? parsed.grantedScopes : null,
    tokenExpiresAt,
    googleId: typeof parsed.googleId === "string" ? parsed.googleId : null,
  };
}

function readStoredDriveSession(expectedGoogleId?: string): StoredDriveSession | null {
  if (typeof window === "undefined") return null;

  const storageCandidates: Storage[] = [];

  try {
    storageCandidates.push(window.localStorage);
  } catch {
    // Local storage may be blocked by the browser.
  }

  try {
    storageCandidates.push(window.sessionStorage);
  } catch {
    // Session storage may be blocked by the browser.
  }

  try {
    for (const storage of storageCandidates) {
      const raw = storage.getItem(DRIVE_SESSION_STORAGE_KEY);
      if (!raw) {
        continue;
      }

      const parsed = parseStoredDriveSession(raw, expectedGoogleId);
      if (!parsed) {
        removeStoredDriveSessionFrom(storage);
        continue;
      }

      try {
        window.localStorage.setItem(DRIVE_SESSION_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore local storage write failures.
      }

      return parsed;
    }

    return null;
  } catch {
    removeStoredDriveSessionFrom(window.localStorage);
    removeStoredDriveSessionFrom(window.sessionStorage);
    return null;
  }
}

function writeStoredDriveSession(session: StoredDriveSession) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DRIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    try {
      window.sessionStorage.setItem(DRIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage failures and rely on in-memory auth state.
    }
  }
}

function clearStoredDriveSession() {
  if (typeof window === "undefined") return;
  removeStoredDriveSessionFrom(window.localStorage);
  removeStoredDriveSessionFrom(window.sessionStorage);
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const storeProfile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const storeSignOut = useStore((s) => s.signOut);
  const storeGoogleId = storeProfile?.google_id ?? null;

  const [user, setUser] = useState<UserProfile | null>(storeProfile);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [grantedScopes, setGrantedScopes] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
  const isConfigured = Boolean(CLIENT_ID);

  // Sync store → local reactive state
  useEffect(() => {
    setUser(storeProfile);
  }, [storeProfile]);

  const clearTokenState = useCallback(() => {
    setAccessToken(null);
    setGrantedScopes(null);
    setTokenExpiresAt(null);
    clearStoredDriveSession();
  }, []);

  const applyTokenResponse = useCallback((resp: google.accounts.oauth2.TokenResponse) => {
    const nextTokenExpiresAt = getTokenExpiresAt(resp.expires_in);
    setAccessToken(resp.access_token);
    setGrantedScopes(resp.scope ?? null);
    setTokenExpiresAt(nextTokenExpiresAt);
    writeStoredDriveSession({
      accessToken: resp.access_token,
      grantedScopes: resp.scope ?? null,
      tokenExpiresAt: nextTokenExpiresAt,
      googleId: user?.google_id ?? storeGoogleId,
    });
  }, [storeGoogleId, user]);

  const hasUsableDriveToken = Boolean(
    accessToken && hasDriveScope(grantedScopes) && (!tokenExpiresAt || tokenExpiresAt > Date.now())
  );

  const ensureTokenClient = useCallback(async () => {
    if (!CLIENT_ID) {
      const message = "Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app.";
      setError(message);
      setIsLoading(false);
      throw new Error(message);
    }

    if (tokenClient) {
      return tokenClient;
    }

    setIsLoading(true);

    try {
      await loadScript("https://accounts.google.com/gsi/client");

      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) {
        throw new Error("Google sign-in failed to initialize");
      }

      const tc = oauth.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });

      setTokenClient(tc);
      setError(null);
      return tc;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Google sign-in";
      setError(message);
      console.error("Failed to initialize Google Identity Services", err);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [tokenClient]);

  const requestToken = useCallback(
    async ({
      prompt,
      fallbackMessage,
      interactive,
    }: {
      prompt: "none" | "" | "consent" | "select_account consent";
      fallbackMessage: string;
      interactive: boolean;
    }) => {
      const client = await ensureTokenClient();

      return new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const rejectWith = (message: string) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          client.error_callback = undefined;
          reject(new Error(message));
        };

        const resolveWith = (resp: google.accounts.oauth2.TokenResponse) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          client.error_callback = undefined;
          resolve(resp);
        };

        // Prevent GIS from hanging forever (especially prompt:"none" on mobile)
        timeoutId = setTimeout(() => {
          rejectWith("Google sign-in timed out. Please try again.");
        }, 15_000);

        client.callback = (resp) => {
          if (resp.error) {
            rejectWith(getGoogleResponseError(resp) ?? fallbackMessage);
            return;
          }

          resolveWith(resp);
        };

        client.error_callback = (error) => {
          rejectWith(getGooglePopupError(error, fallbackMessage, interactive));
        };

        client.requestAccessToken({ prompt });
      });
    },
    [ensureTokenClient]
  );

  // Load GIS script & init token client (skip if no CLIENT_ID)
  useEffect(() => {
    let mounted = true;
    ensureTokenClient().catch(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [ensureTokenClient]);

  // Fetch user profile from access token
  const fetchUserInfo = useCallback(
    async (token: string) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const profile: UserProfile = {
          google_id: data.sub,
          name: data.name ?? data.email,
          email: data.email,
          image: data.picture ?? null,
        };
        setUser(profile);
        setProfile(profile);
      } catch (err) {
        console.error("Failed to fetch user info", err);
      }
    },
    [setProfile]
  );

  useEffect(() => {
    if (!storeGoogleId) {
      return;
    }

    if (hasUsableDriveToken) {
      return;
    }

    const storedSession = readStoredDriveSession(storeGoogleId ?? undefined);

    if (!storedSession) {
      if (accessToken || grantedScopes || tokenExpiresAt) {
        clearTokenState();
      }
      return;
    }

    setAccessToken(storedSession.accessToken);
    setGrantedScopes(storedSession.grantedScopes);
    setTokenExpiresAt(storedSession.tokenExpiresAt);
    setError(null);
  }, [
    accessToken,
    clearTokenState,
    grantedScopes,
    hasUsableDriveToken,
    storeGoogleId,
    tokenExpiresAt,
  ]);

  useEffect(() => {
    if (!accessToken || !hasDriveScope(grantedScopes)) {
      return;
    }

    if (tokenExpiresAt && tokenExpiresAt <= Date.now()) {
      clearStoredDriveSession();
      return;
    }

    writeStoredDriveSession({
      accessToken,
      grantedScopes,
      tokenExpiresAt,
      googleId: user?.google_id ?? storeGoogleId,
    });
  }, [accessToken, grantedScopes, storeGoogleId, tokenExpiresAt, user]);

  // Sign in with popup → gets token + user info in one step
  const signIn = useCallback(async () => {
    setError(null);

    try {
      const resp = await requestToken({
        prompt: "select_account consent",
        fallbackMessage: "Google sign-in failed",
        interactive: true,
      });
      applyTokenResponse(resp);
      await fetchUserInfo(resp.access_token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      throw new Error(message);
    }
  }, [applyTokenResponse, fetchUserInfo, requestToken]);

  // Request Drive access token (reuses existing or prompts)
  const requestDriveAccess = useCallback((options?: { interactive?: boolean }): Promise<string> => {
    const interactive = options?.interactive ?? true;

    return new Promise((resolve, reject) => {
      if (hasUsableDriveToken && accessToken) {
        resolve(accessToken);
        return;
      }

      const authorize = async () => {
        try {
          const storedSession = readStoredDriveSession(user?.google_id ?? storeGoogleId ?? undefined);

          if (storedSession && hasDriveScope(storedSession.grantedScopes)) {
            setAccessToken(storedSession.accessToken);
            setGrantedScopes(storedSession.grantedScopes);
            setTokenExpiresAt(storedSession.tokenExpiresAt);
            setError(null);
            resolve(storedSession.accessToken);
            return;
          }

          if (!interactive) {
            // Try a silent GIS refresh (no popup) before giving up.
            // This works when the user is still signed in to Google and has
            // previously granted Drive access — Google issues a fresh token
            // without any UI. Only if this fails do we reject.
            try {
              const silentResp = await requestToken({
                prompt: "none",
                fallbackMessage: "Google Drive silent refresh failed",
                interactive: false,
              });
              applyTokenResponse(silentResp);
              if (!user) {
                await fetchUserInfo(silentResp.access_token);
              }
              resolve(silentResp.access_token);
              return;
            } catch {
              throw new Error(
                user
                  ? "Google Drive session expired. Reconnect Drive to continue syncing."
                  : "Sign in with Google again to continue Drive sync."
              );
            }
          }

          const resp = await requestToken({
            prompt: user ? "consent" : "select_account consent",
            fallbackMessage: "Google Drive authorization failed",
            interactive: true,
          });

          applyTokenResponse(resp);
          if (!user) {
            await fetchUserInfo(resp.access_token);
          }
          setError(null);
          resolve(resp.access_token);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Google services not loaded yet. Please try again.";
          if (interactive) {
            setError(message);
          }
          reject(new Error(message));
        }
      };

      authorize();
    });
  }, [accessToken, applyTokenResponse, fetchUserInfo, hasUsableDriveToken, requestToken, storeGoogleId, user]);

  // Sign out
  const signOutHandler = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
    clearTokenState();
    storeSignOut();
  }, [clearTokenState, storeSignOut]);

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isReady: !isLoading,
        isConfigured,
        error,
        signIn,
        requestDriveAccess,
        signOut: signOutHandler,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const ctx = useContext(GoogleAuthContext);
  if (!ctx) throw new Error("useGoogleAuth must be used inside GoogleAuthProvider");
  return ctx;
}
