"use client";

import { type Session, type User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/types/data";

// ─── Context Types ──────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSupabaseAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used inside SupabaseAuthProvider");
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setStoreProfile = useStore((s) => s.setProfile);
  const storeSignOut = useStore((s) => s.signOut);

  // Derive UserProfile from Supabase User + profiles table
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // ── Build UserProfile from Supabase auth user + profiles table ──────────

  const buildUserProfile = useCallback(
    async (user: User) => {
      try {
        const client = getSupabase();

        // Try to fetch editable fields from profiles table
        const { data: profileRow } = await client
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        const p: UserProfile = {
          google_id: user.id,
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            "User",
          email: user.email ?? "",
          image: user.user_metadata?.avatar_url ?? null,
          displayName: profileRow?.display_name ?? null,
          bio: profileRow?.bio ?? null,
          customImage: profileRow?.custom_image ?? null,
        };

        setProfile(p);
        setStoreProfile(p);
      } catch {
        // Fallback without profiles table data
        const p: UserProfile = {
          google_id: user.id,
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            "User",
          email: user.email ?? "",
          image: user.user_metadata?.avatar_url ?? null,
        };
        setProfile(p);
        setStoreProfile(p);
      }
    },
    [setStoreProfile],
  );

  // ── Mount: get initial session & listen for auth changes ─────────────────

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    let client;
    try {
      client = getSupabase();
    } catch (err) {
      console.warn("[SupabaseAuth] Failed to create Supabase client:", err);
      setError("Failed to initialize Supabase client");
      setIsLoading(false);
      return;
    }

    // Get initial session
    client.auth.getSession().then(({ data, error: sessionErr }) => {
      if (sessionErr) {
        console.warn("[SupabaseAuth] getSession error:", sessionErr.message);
        setError(sessionErr.message);
        setIsLoading(false);
        return;
      }
      const s = data.session;
      setSession(s);
      if (s?.user) {
        buildUserProfile(s.user);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        buildUserProfile(s.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, buildUserProfile]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    if (!isConfigured) {
      setError("Supabase is not configured. Check environment variables.");
      return;
    }
    setError(null);
    const client = getSupabase();
    const { error: signInErr } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (signInErr) {
      setError(signInErr.message);
      throw signInErr;
    }
  }, [isConfigured]);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    await client.auth.signOut();
    storeSignOut();
    setProfile(null);
    setSession(null);
  }, [storeSignOut]);

  // ── Value ────────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user: profile,
    session,
    isLoading,
    isConfigured,
    error: error,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
