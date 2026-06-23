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
import { useStore, serializeBackup, deserializeBackup } from "./store";
import { uploadBackup, downloadBackup } from "./drive";

// ─── Types ───────────────────────────────────────────────────────────────────

const AUTOSYNC_DEBOUNCE_MS = 30_000;

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
  getSilentToken,
  children,
}: {
  getInteractiveToken: (() => Promise<string>) | null;
  getSilentToken: (() => Promise<string>) | null;
  children: ReactNode;
}) {
  const completeSync = useStore((s) => s.completeSync);
  const importData = useStore((s) => s.importData);
  const autoSyncEnabled = useStore((s) => s.settings.autoSync);
  const hasPendingChanges = useStore((s) => s.syncMetadata.hasPendingChanges);

  const [state, setState] = useState<SyncState>({ status: "idle", error: null });
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);
  const autoSyncRef = useRef<() => void>(() => {});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track online / offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      autoSyncRef.current();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const performSync = useCallback(async (token: string) => {
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
  }, [completeSync]);

  const syncNow = useCallback(async (tokenOverride?: string) => {
    if (!navigator.onLine) {
      throw new Error("You are offline. Reconnect and try again.");
    }
    if (!getInteractiveToken || syncingRef.current) return;

    syncingRef.current = true;
    setState({ status: "syncing", error: null });

    try {
      const token = tokenOverride ?? await getInteractiveToken();
      await performSync(token);
      setState({ status: "idle", error: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Backup failed");
      setState({ status: "error", error: error.message });
      throw error;
    } finally {
      syncingRef.current = false;
    }
  }, [getInteractiveToken, performSync]);

  // Silent auto-sync + auto-restore: no state changes, no rethrow.
  const autoSync = useCallback(async () => {
    if (syncingRef.current) {
      console.info("[ServiceFlow] Auto-sync skipped: already syncing");
      return;
    }
    if (!navigator.onLine) {
      console.info("[ServiceFlow] Auto-sync skipped: offline");
      return;
    }
    if (!autoSyncEnabled) {
      console.info("[ServiceFlow] Auto-sync skipped: disabled in settings");
      return;
    }
    if (!getSilentToken) {
      console.info("[ServiceFlow] Auto-sync skipped: no silent token getter");
      return;
    }

    console.info("[ServiceFlow] Auto-sync starting");
    syncingRef.current = true;
    try {
      const token = await getSilentToken();

      if (hasPendingChanges) {
        // Upload local changes to Drive
        await performSync(token);
        console.info("[ServiceFlow] Auto-sync: uploaded changes");
      } else {
        // No pending changes — check if another device uploaded a newer backup
        try {
          const backupText = await downloadBackup(token);
          const backup = JSON.parse(backupText);
          const lastSynced = useStore.getState().settings.lastSyncedAt;

          if (backup.exported_at && (!lastSynced || new Date(backup.exported_at) > new Date(lastSynced))) {
            const parsed = deserializeBackup(backup);
            importData(parsed, { source: "remote" });
            console.info("[ServiceFlow] Auto-restore: applied newer backup from Drive");
          } else {
            console.info("[ServiceFlow] Auto-restore: local data is up to date");
          }
        } catch {
          // No backup exists or download failed — silent skip
          console.info("[ServiceFlow] Auto-restore: no backup found or download failed");
        }
      }
    } catch (err) {
      console.warn("[ServiceFlow] Auto-sync failed:", err instanceof Error ? err.message : err);
    } finally {
      syncingRef.current = false;
    }
  }, [autoSyncEnabled, getSilentToken, hasPendingChanges, importData, performSync]);

  // Keep a ref to the latest autoSync so mount-only effects call the current version.
  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  // Trigger: app open + tab becoming visible again.
  useEffect(() => {
    autoSyncRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        autoSyncRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Trigger: debounced 30s after the last edit.
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      autoSyncRef.current();
    }, AUTOSYNC_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [hasPendingChanges]);

  return (
    <SyncContext.Provider value={{ ...state, syncNow, isOnline }}>
      {children}
    </SyncContext.Provider>
  );
}
