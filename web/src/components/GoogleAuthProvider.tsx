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
  /** whether the app has a Google OAuth client id configured */
  isConfigured: boolean;
  /** configuration or runtime auth error to show in the UI */
  error: string | null;
  /** Trigger Google sign-in popup (also grants Drive access) */
  signIn: () => Promise<void>;
  /** Request Drive access token (reuses existing or prompts) */
  requestDriveAccess: () => Promise<string>;
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

function hasDriveScope(scope: string | null | undefined) {
  if (!scope) return false;
  return scope.split(/\s+/).includes(DRIVE_SCOPE);
}

function getGoogleResponseError(resp: google.accounts.oauth2.TokenResponse) {
  return resp.error_description ?? resp.error ?? null;
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const storeProfile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const storeSignOut = useStore((s) => s.signOut);

  const [user, setUser] = useState<UserProfile | null>(storeProfile);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [grantedScopes, setGrantedScopes] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
  const isConfigured = Boolean(CLIENT_ID);

  // Sync store → local reactive state
  useEffect(() => {
    setUser(storeProfile);
  }, [storeProfile]);

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

  // Sign in with popup → gets token + user info in one step
  const signIn = useCallback(async () => {
    const client = await ensureTokenClient();
    setError(null);

    await new Promise<void>((resolve, reject) => {
      client.callback = async (resp) => {
        if (resp.error) {
          const message = getGoogleResponseError(resp) ?? "Google sign-in failed";
          setError(message);
          console.error("Sign-in error:", resp);
          reject(new Error(message));
          return;
        }

        try {
          setAccessToken(resp.access_token);
          setGrantedScopes(resp.scope ?? null);
          await fetchUserInfo(resp.access_token);
          resolve();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load Google profile";
          setError(message);
          reject(new Error(message));
        }
      };

      client.requestAccessToken({ prompt: "select_account consent" });
    });
  }, [ensureTokenClient, fetchUserInfo]);

  // Request Drive access token (reuses existing or prompts)
  const requestDriveAccess = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (accessToken && hasDriveScope(grantedScopes)) {
        resolve(accessToken);
        return;
      }
      ensureTokenClient()
        .then((client) => {
          client.callback = async (resp) => {
            if (resp.error) {
              const message = getGoogleResponseError(resp) ?? "Google Drive authorization failed";
              setError(message);
              reject(new Error(message));
              return;
            }
            setAccessToken(resp.access_token);
            setGrantedScopes(resp.scope ?? null);
            if (!user) {
              await fetchUserInfo(resp.access_token);
            }
            setError(null);
            resolve(resp.access_token);
          };
          client.requestAccessToken({ prompt: "consent" });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Google services not loaded yet. Please try again.";
          setError(message);
          reject(new Error(message));
        });
    });
  }, [accessToken, ensureTokenClient, fetchUserInfo, grantedScopes, user]);

  // Sign out
  const signOutHandler = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
    setAccessToken(null);
    setGrantedScopes(null);
    storeSignOut();
  }, [storeSignOut]);

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
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
