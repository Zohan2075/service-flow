"use client";

import { SupabaseAuthProvider } from "@/components/SupabaseAuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { SyncProvider } from "@/lib/sync";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <ThemeProvider>
        <I18nProvider>
          <SyncProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                className: "dark:bg-slate-800 dark:text-white",
              }}
            />
          </SyncProvider>
        </I18nProvider>
      </ThemeProvider>
    </SupabaseAuthProvider>
  );
}
