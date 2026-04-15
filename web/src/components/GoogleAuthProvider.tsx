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
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
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

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const storeProfile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const storeSignOut = useStore((s) => s.signOut);

  const [user, setUser] = useState<UserProfile | null>(storeProfile);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
  const isConfigured = Boolean(CLIENT_ID);

  // Sync store → local reactive state
  useEffect(() => {
    setUser(storeProfile);
  }, [storeProfile]);

  // Load GIS script & init token client (skip if no CLIENT_ID)
  useEffect(() => {
    if (!CLIENT_ID) {
      setError("Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app.");
      setIsLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        await loadScript("https://accounts.google.com/gsi/client");
        if (!mounted) return;

        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {}, // overridden per call
        });
        setTokenClient(tc);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load Google sign-in");
        }
        console.error("Failed to load Google Identity Services", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
    if (!tokenClient) {
      const message = CLIENT_ID
        ? "Google services are still loading. Please try again in a moment."
        : "Google sign-in is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app.";
      setError(message);
      throw new Error(message);
    }
    setError(null);

    await new Promise<void>((resolve, reject) => {
      tokenClient.callback = async (resp) => {
        if (resp.error) {
          const message = resp.error;
          setError(message);
          console.error("Sign-in error:", resp.error);
          reject(new Error(message));
          return;
        }

        try {
          setAccessToken(resp.access_token);
          await fetchUserInfo(resp.access_token);
          resolve();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load Google profile";
          setError(message);
          reject(new Error(message));
        }
      };

      tokenClient.requestAccessToken({ prompt: "select_account consent" });
    });
  }, [tokenClient, fetchUserInfo]);

  // Request Drive access token (reuses existing or prompts)
  const requestDriveAccess = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (accessToken) {
        resolve(accessToken);
        return;
      }
      if (!tokenClient) {
        const msg = CLIENT_ID
          ? "Google services not loaded yet. Please try again."
          : "Google Client ID is not configured. Create a .env.local file with NEXT_PUBLIC_GOOGLE_CLIENT_ID and restart the dev server.";
        setError(msg);
        reject(new Error(msg));
        return;
      }
      tokenClient.callback = async (resp) => {
        if (resp.error) {
          setError(resp.error);
          reject(new Error(resp.error));
          return;
        }
        setAccessToken(resp.access_token);
        if (!user) {
          await fetchUserInfo(resp.access_token);
        }
        setError(null);
        resolve(resp.access_token);
      };
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }, [accessToken, tokenClient, user, fetchUserInfo]);

  // Sign out
  const signOutHandler = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null);
    setAccessToken(null);
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
