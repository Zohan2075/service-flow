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

export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncState {
  status: SyncStatus;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  syncNow: (tokenOverride?: string) => Promise<void>;
  isOnline: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside SyncProvider");
  return ctx;
}

// ─── Manual-only Sync Provider ───────────────────────────────────────────────

export function SyncProvider({
  getInteractiveToken,
  children,
}: {
  getInteractiveToken: (() => Promise<string>) | null;
  children: ReactNode;
}) {
  const completeSync = useStore((s) => s.completeSync);

  const [state, setState] = useState<SyncState>({ status: "idle", error: null });
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);

  // Track online / offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const syncNow = useCallback(async (tokenOverride?: string) => {
    if (!navigator.onLine) {
      throw new Error("You are offline. Reconnect and try again.");
    }
    if (!getInteractiveToken || syncingRef.current) return;

    syncingRef.current = true;
    setState({ status: "syncing", error: null });

    try {
      const token = tokenOverride ?? await getInteractiveToken();
      const syncedAt = new Date().toISOString();
      const store = useStore.getState();
      const backup = serializeBackup({
        profile: store.profile,
        settings: { ...store.settings, lastSyncedAt: syncedAt },
        serviceTypes: store.serviceTypes,
        timeEntries: store.timeEntries,
        goals: store.goals,
      });

      await uploadBackup(token, JSON.stringify(backup));
      completeSync(syncedAt);
      setState({ status: "idle", error: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Backup failed");
      setState({ status: "error", error: error.message });
      throw error;
    } finally {
      syncingRef.current = false;
    }
  }, [completeSync, getInteractiveToken]);

  return (
    <SyncContext.Provider value={{ ...state, syncNow, isOnline }}>
      {children}
    </SyncContext.Provider>
  );
}
