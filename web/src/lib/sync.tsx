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
import { downloadBackup, uploadBackup } from "./drive";

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

function isMissingDriveBackup(error: unknown) {
  return error instanceof Error && error.message === "No backup found on Google Drive";
}

function getSyncComparableSettings(settings: ReturnType<typeof useStore.getState>["settings"]) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => key !== "autoSync" && key !== "lastSyncedAt")
  );
}

function getTimestampValue(value: string | null | undefined) {
  if (!value) return 0;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getComparableSyncSnapshot(state: {
  profile: ReturnType<typeof useStore.getState>["profile"];
  settings: ReturnType<typeof useStore.getState>["settings"];
  serviceTypes: ReturnType<typeof useStore.getState>["serviceTypes"];
  timeEntries: ReturnType<typeof useStore.getState>["timeEntries"];
}) {
  return {
    profile: state.profile,
    settings: getSyncComparableSettings(state.settings),
    serviceTypes: state.serviceTypes,
    timeEntries: state.timeEntries,
  };
}

function useStoreHydrated() {
  const [isHydrated, setIsHydrated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return useStore.persist?.hasHydrated?.() ?? true;
  });

  useEffect(() => {
    const persistApi = useStore.persist;

    if (!persistApi?.hasHydrated || !persistApi?.onFinishHydration) {
      setIsHydrated(true);
      return;
    }

    setIsHydrated(persistApi.hasHydrated());

    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsHydrated(true);
    });

    return unsubscribe;
  }, []);

  return isHydrated;
}

export function SyncProvider({
  authReady,
  getToken,
  getInteractiveToken,
  children,
}: {
  authReady: boolean;
  getToken: (() => Promise<string>) | null;
  getInteractiveToken?: (() => Promise<string>) | null;
  children: ReactNode;
}) {
  const autoSync = useStore((s) => s.settings.autoSync);
  const completeSync = useStore((s) => s.completeSync);
  const isStoreHydrated = useStoreHydrated();

  const [state, setState] = useState<SyncState>({ status: "idle", error: null });
  const [isOnline, setIsOnline] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const dirtyRef = useRef(false);
  const syncingRef = useRef(false);
  const startupSyncCompletedRef = useRef(false);
  const getTokenRef = useRef(getToken);
  const getInteractiveTokenRef = useRef(getInteractiveToken);
  getTokenRef.current = getToken;
  getInteractiveTokenRef.current = getInteractiveToken;

  const createBackupPayload = useCallback((syncedAt: string, forceAutoSync = false) => {
    const store = useStore.getState();

    return serializeBackup({
      profile: store.profile,
      settings: {
        ...store.settings,
        autoSync: forceAutoSync ? true : store.settings.autoSync,
        lastSyncedAt: syncedAt,
      },
      serviceTypes: store.serviceTypes,
      timeEntries: store.timeEntries,
    });
  }, []);

  const restoreFromBackup = useCallback((
    backup: ReturnType<typeof deserializeBackup>,
    {
      preserveAutoSync,
      lastSyncedAt,
    }: {
      preserveAutoSync: boolean;
      lastSyncedAt: string | null;
    }
  ) => {
    const currentSettings = useStore.getState().settings;

    useStore.getState().importData({
      ...backup,
      settings: preserveAutoSync
        ? {
            ...backup.settings,
            autoSync: true,
            lastSyncedAt: lastSyncedAt ?? currentSettings.lastSyncedAt,
          }
        : backup.settings,
    }, { source: "remote" });
  }, []);

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

  const runSync = useCallback(async (throwOnError = false, interactive = false) => {
    if (!navigator.onLine) {
      setState({ status: "offline", error: null });
      if (throwOnError) {
        throw new Error("You are offline. Reconnect and try again.");
      }
      return;
    }

    const tokenProvider = interactive
      ? getInteractiveTokenRef.current ?? getTokenRef.current
      : getTokenRef.current;

    if (!tokenProvider || syncingRef.current) return;
    syncingRef.current = true;
    setState({ status: "syncing", error: null });
    try {
      const token = await tokenProvider();
      const syncedAt = new Date().toISOString();
      const backup = createBackupPayload(syncedAt);
      await uploadBackup(token, JSON.stringify(backup));
      dirtyRef.current = false;
      completeSync(syncedAt);
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
  }, [completeSync, createBackupPayload]);

  const syncNow = useCallback(async () => {
    await runSync(true, true);
  }, [runSync]);

  useEffect(() => {
    if (!autoSync) {
      startupSyncCompletedRef.current = false;
      return;
    }

    if (
      !isStoreHydrated ||
      !authReady ||
      !isOnline ||
      !getToken ||
      startupSyncCompletedRef.current ||
      syncingRef.current
    ) {
      return;
    }

    let cancelled = false;

    const runStartupSync = async () => {
      syncingRef.current = true;
      setState({ status: "syncing", error: null });

      try {
        const token = await getTokenRef.current?.();

        if (!token) {
          throw new Error("Sign in with Google again to continue Drive sync.");
        }

        const localState = useStore.getState();
        let remoteBackup: ReturnType<typeof deserializeBackup> | null = null;

        try {
          const backupText = await downloadBackup(token);
          remoteBackup = deserializeBackup(JSON.parse(backupText));
        } catch (error) {
          if (!isMissingDriveBackup(error)) {
            throw error;
          }
        }

        if (cancelled) {
          return;
        }

        const remoteSyncedAt = remoteBackup
          ? remoteBackup.settings.lastSyncedAt ?? remoteBackup.exported_at
          : null;
        const localSyncedAt = localState.settings.lastSyncedAt;
        const remoteSnapshotMatchesLocal = remoteBackup
          ? JSON.stringify(getComparableSyncSnapshot({
            profile: remoteBackup.profile,
            settings: remoteBackup.settings,
            serviceTypes: remoteBackup.service_types,
            timeEntries: remoteBackup.time_entries,
          })) ===
            JSON.stringify(getComparableSyncSnapshot(localState))
          : false;
        const shouldRestoreRemote =
          Boolean(remoteBackup) &&
          !localState.syncMetadata.hasPendingChanges &&
          getTimestampValue(remoteSyncedAt) > getTimestampValue(localSyncedAt);
        const shouldUploadLocal =
          !remoteBackup ||
          localState.syncMetadata.hasPendingChanges ||
          getTimestampValue(localSyncedAt) > getTimestampValue(remoteSyncedAt) ||
          (getTimestampValue(localSyncedAt) === getTimestampValue(remoteSyncedAt) && !remoteSnapshotMatchesLocal);

        if (shouldRestoreRemote && remoteBackup) {
          restoreFromBackup(remoteBackup, {
            preserveAutoSync: true,
            lastSyncedAt: remoteSyncedAt,
          });
          completeSync(remoteSyncedAt ?? new Date().toISOString(), { autoSync: true });
        } else if (shouldUploadLocal) {
          const syncedAt = new Date().toISOString();
          const backup = createBackupPayload(syncedAt, true);
          await uploadBackup(token, JSON.stringify(backup));

          if (cancelled) {
            return;
          }

          completeSync(syncedAt, { autoSync: true });
        } else {
          completeSync(remoteSyncedAt ?? localSyncedAt ?? new Date().toISOString(), {
            autoSync: true,
          });
        }

        if (cancelled) {
          return;
        }

        dirtyRef.current = false;
        startupSyncCompletedRef.current = true;
        setState({ status: "idle", error: null });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const syncError = error instanceof Error ? error : new Error("Sync failed");
        setState({ status: "error", error: syncError.message });
      } finally {
        syncingRef.current = false;
      }
    };

    void runStartupSync();

    return () => {
      cancelled = true;
    };
  }, [authReady, autoSync, completeSync, createBackupPayload, getToken, isOnline, isStoreHydrated, restoreFromBackup]);

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

      const settingsChanged =
        JSON.stringify(getSyncComparableSettings(cur.settings)) !==
        JSON.stringify(getSyncComparableSettings(prev.settings));
      const profileChanged = JSON.stringify(cur.profile) !== JSON.stringify(prev.profile);

      if (
        settingsChanged ||
        cur.serviceTypes !== prev.serviceTypes ||
        cur.timeEntries !== prev.timeEntries ||
        profileChanged
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

  // Best-effort flush when the app is backgrounded or the tab is closing.
  useEffect(() => {
    if (!autoSync || !getToken) {
      return;
    }

    const flushPendingChanges = () => {
      if (!dirtyRef.current || syncingRef.current || !navigator.onLine) {
        return;
      }

      void runSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingChanges();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingChanges);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingChanges);
    };
  }, [autoSync, getToken, runSync]);

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
