"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore, serializeBackup } from "./store";
import { uploadBackup } from "./drive";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export interface SyncState {
  status: SyncStatus;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  syncNow: () => Promise<void>;
  isOnline: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside SyncProvider");
  return ctx;
}

// ─── Sync Provider ───────────────────────────────────────────────────────────

const DEBOUNCE_MS = 5_000;    // 5s after last change
const INTERVAL_MS = 5 * 60_000; // 5 min

export function SyncProvider({
  getToken,
  children,
}: {
  getToken: (() => Promise<string>) | null;
  children: ReactNode;
}) {
  const autoSync = useStore((s) => s.settings.autoSync);
  const updateSettings = useStore((s) => s.updateSettings);

  const [state, setState] = useState<SyncState>({ status: "idle", error: null });
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const dirtyRef = useRef(false);
  const syncingRef = useRef(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Track online / offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const runSync = useCallback(async (throwOnError = false) => {
    if (!navigator.onLine) {
      setState({ status: "offline", error: null });
      if (throwOnError) {
        throw new Error("You are offline. Reconnect and try again.");
      }
      return;
    }

    if (!getTokenRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setState({ status: "syncing", error: null });
    try {
      const token = await getTokenRef.current();
      const store = useStore.getState();
      const backup = serializeBackup({
        profile: store.profile,
        settings: store.settings,
        serviceTypes: store.serviceTypes,
        timeEntries: store.timeEntries,
      });
      await uploadBackup(token, JSON.stringify(backup));
      dirtyRef.current = false;
      updateSettings({ lastSyncedAt: new Date().toISOString() });
      setState({ status: "idle", error: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sync failed");
      setState({
        status: "error",
        error: error.message,
      });

      if (throwOnError) {
        throw error;
      }
    } finally {
      syncingRef.current = false;
    }
  }, [updateSettings]);

  const syncNow = useCallback(async () => {
    await runSync(true);
  }, [runSync]);

  // Subscribe to store changes for dirty detection
  useEffect(() => {
    if (!autoSync || !getToken) {
      setState({ status: "idle", error: null });
      return;
    }

    if (!isOnline) {
      setState({ status: "offline", error: null });
      return;
    }

    setState({ status: "idle", error: null });

    const unsub = useStore.subscribe((cur, prev) => {
      if (syncingRef.current) return;
      if (
        cur.serviceTypes !== prev.serviceTypes ||
        cur.timeEntries !== prev.timeEntries ||
        cur.profile !== prev.profile
      ) {
        dirtyRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (dirtyRef.current) {
            void runSync();
          }
        }, DEBOUNCE_MS);
      }
    });

    // Interval sync
    intervalRef.current = setInterval(() => {
      if (dirtyRef.current) {
        void runSync();
      }
    }, INTERVAL_MS);

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSync, getToken, isOnline, runSync]);

  // Sync pending changes when coming back online
  useEffect(() => {
    if (isOnline && dirtyRef.current && autoSync && getToken) {
      void runSync();
    }
  }, [isOnline, autoSync, getToken, runSync]);

  return (
    <SyncContext.Provider value={{ ...state, syncNow, isOnline }}>
      {children}
    </SyncContext.Provider>
  );
}
