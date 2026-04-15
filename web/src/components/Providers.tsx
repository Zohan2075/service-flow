"use client";

import { useCallback } from "react";
import { GoogleAuthProvider, useGoogleAuth } from "@/components/GoogleAuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SyncProvider } from "@/lib/sync";
import { Toaster } from "react-hot-toast";

function SyncBridge({ children }: { children: React.ReactNode }) {
  const { accessToken, requestDriveAccess } = useGoogleAuth();

  const getToken = useCallback(async () => {
    if (accessToken) return accessToken;
    return requestDriveAccess();
  }, [accessToken, requestDriveAccess]);

  return <SyncProvider getToken={getToken}>{children}</SyncProvider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleAuthProvider>
      <ThemeProvider>
        <SyncBridge>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: "dark:bg-slate-800 dark:text-white",
            }}
          />
        </SyncBridge>
      </ThemeProvider>
    </GoogleAuthProvider>
  );
}
