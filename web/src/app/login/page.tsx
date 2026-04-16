"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoogleAuth } from "@/components/GoogleAuthProvider";
import { useT } from "@/lib/i18n";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, isConfigured, error, signIn } = useGoogleAuth();
  const { t } = useT();
  const [signingIn, setSigningIn] = useState(false);

  // Redirect when already signed in
  useEffect(() => {
    if (user) router.replace("/calendar");
  }, [user, router]);

  const handleSignIn = async () => {
    if (isLoading) {
      toast(t("login.loadingGoogle"));
      return;
    }

    try {
      setSigningIn(true);
      await signIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-start justify-center bg-canvas px-4 py-8 sm:items-center sm:py-4">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
          <div className="bg-primary rounded-xl p-2.5 flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-2xl">event_note</span>
          </div>
          <h1 className="font-bold text-2xl tracking-tight">ServiceFlow</h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-center">{t("login.welcome")}</h2>

          {!isConfigured && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
              {t("login.googleHint")}
            </div>
          )}

          {error && isConfigured && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Fallback manual trigger */}
          <button
            onClick={handleSignIn}
            disabled={signingIn || !isConfigured}
            className="w-full min-h-12 flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {signingIn ? t("login.loadingGoogle") : t("login.continueGoogle")}
          </button>

          {isConfigured && isLoading && (
            <p className="mt-3 text-center text-xs text-slate-400">
              {t("login.loadingGoogle")}
            </p>
          )}

          <p className="text-xs text-slate-400 text-center mt-4">
            {t("login.footnote")}
          </p>
        </div>
      </div>
    </div>
  );
}
