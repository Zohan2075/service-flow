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
import { exchangeDriveCode, getDriveToken, revokeDriveToken } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoogleAuthContextValue {
  /** Current signed-in user profile (null = not signed in) */
  user: UserProfile | null;
  /** Access token for Google APIs (Drive). Volatile in-memory cache. */
  accessToken: string | null;
  /** true while GIS script is loading */
  isLoading: boolean;
  /** true once auth initialization has completed for this page load */
  isReady: boolean;
  /** whether the app has a Google OAuth client id configured */
  isConfigured: boolean;
  /** true when a backend JWT is stored (Drive is connected) */
  hasStoredBackendJwt: boolean;
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

function getCodePopupError(
  error: google.accounts.oauth2.NonOAuthError | undefined,
  fallbackMessage: string
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "this origin";
  const isLocalOrigin = typeof window !== "undefined"
    ? ["localhost", "127.0.0.1"].includes(window.location.hostname)
    : false;

  switch (error?.type) {
    case "popup_failed_to_open":
      return "Google sign-in popup was blocked by the browser. Allow popups for this site and try again.";
    case "popup_closed":
      if (isLocalOrigin) {
        return `Google sign-in could not complete. If Google showed redirect_uri_mismatch, add ${origin} to the OAuth client's Authorized JavaScript origins in Google Cloud Console, then try again.`;
      }
      return "Google sign-in was cancelled before it completed.";
    default:
      return fallbackMessage;
  }
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const storeProfile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const storeSignOut = useStore((s) => s.signOut);

  const [user, setUser] = useState<UserProfile | null>(storeProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeClient, setCodeClient] = useState<google.accounts.oauth2.CodeClient | null>(null);
  const [backendJwt, setBackendJwt] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const isConfigured = Boolean(CLIENT_ID);

  const hasStoredBackendJwt = Boolean(backendJwt);

  // Hydrate backendJwt from localStorage on mount
  useEffect(() => {
    setBackendJwt(getStoredBackendJwt());
  }, []);

  // Sync store → local reactive state
  useEffect(() => {
    setUser(storeProfile);
  }, [storeProfile]);

  // ─── GIS initialization ──────────────────────────────────────────────────

  const ensureCodeClient = useCallback(async () => {
    if (!CLIENT_ID) {
      const message = "Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app.";
      setError(message);
      setIsLoading(false);
      throw new Error(message);
    }

    if (codeClient) {
      return codeClient;
    }

    setIsLoading(true);

    try {
      await loadScript("https://accounts.google.com/gsi/client");

      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) {
        throw new Error("Google sign-in failed to initialize");
      }

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

  // ─── Code-model popup ────────────────────────────────────────────────────

  const requestCode = useCallback(
    async (): Promise<google.accounts.oauth2.CodeResponse> => {
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
          rejectWith(getCodePopupError(error, "Google sign-in was cancelled."));
        };

        client.requestCode();
      });
    },
    [ensureCodeClient]
  );

  // ─── Backend exchange + user info ────────────────────────────────────────

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

  // ─── Public auth functions ───────────────────────────────────────────────

  const signIn = useCallback(async () => {
    setError(null);

    try {
      // 1. Open GIS code popup → get auth code
      const codeResp = await requestCode();

      // 2. Exchange code with backend → get backend JWT
      const tokenResp = await exchangeDriveCode(codeResp.code, window.location.origin);

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
      const tokenResp = await exchangeDriveCode(codeResp.code, window.location.origin);
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

  // ─── Mount-time initialization ───────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    ensureCodeClient().catch(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [ensureCodeClient]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
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
  );
}

export function useGoogleAuth() {
  const ctx = useContext(GoogleAuthContext);
  if (!ctx) throw new Error("useGoogleAuth must be used inside GoogleAuthProvider");
  return ctx;
}
