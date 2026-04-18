"use client";

import { useCallback } from "react";
import { GoogleAuthProvider, useGoogleAuth } from "@/components/GoogleAuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { SyncProvider } from "@/lib/sync";
import { Toaster } from "react-hot-toast";

function SyncBridge({ children }: { children: React.ReactNode }) {
  const { accessToken, requestDriveAccess } = useGoogleAuth();

  const getInteractiveToken = useCallback(async () => {
    if (accessToken) return accessToken;
    return requestDriveAccess({ interactive: true });
  }, [accessToken, requestDriveAccess]);

  return (
    <SyncProvider getInteractiveToken={getInteractiveToken}>
      {children}
    </SyncProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleAuthProvider>
      <ThemeProvider>
        <I18nProvider>
          <SyncBridge>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                className: "dark:bg-slate-800 dark:text-white",
              }}
            />
          </SyncBridge>
        </I18nProvider>
      </ThemeProvider>
    </GoogleAuthProvider>
  );
}
