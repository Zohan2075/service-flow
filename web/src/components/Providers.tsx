"use client";

import { MotionConfig } from "motion/react";
import { SupabaseAuthProvider } from "@/components/SupabaseAuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { SyncProvider } from "@/lib/sync";
import { InterestedNotificationsProvider } from "@/components/InterestedNotificationsProvider";
import SyncGuard from "@/components/SyncGuard";
import { SPRING_SOFT } from "@/components/ui/motion";

import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING_SOFT}>
      <SupabaseAuthProvider>
        <ThemeProvider>
          <I18nProvider>
            <SyncProvider>
              <InterestedNotificationsProvider>
                {children}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    className: "!rounded-xl !border !border-slate-200 dark:!border-slate-700 !bg-surface dark:!bg-slate-800 !text-slate-800 dark:!text-white !shadow-card",
                  }}
                />
                <SyncGuard />
              </InterestedNotificationsProvider>
            </SyncProvider>
          </I18nProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </MotionConfig>
  );
}
