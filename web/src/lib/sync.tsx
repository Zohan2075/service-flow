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
import { useStore } from "./store";
import { pushAll, pullAll, getSupabase } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

const AUTOSYNC_DEBOUNCE_MS = 2_000; // 2 seconds — near-instant sync

export type SyncStatus = "idle" | "syncing" | "error";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if remote state is effectively empty (no meaningful data). */
function isRemoteEmpty(state: {
  serviceTypes: unknown[];
  timeEntries: unknown[];
  goals: unknown[];
  interestedPeople: unknown[];
}) {
  return (
    state.serviceTypes.length === 0 &&
    state.timeEntries.length === 0 &&
    state.goals.length === 0 &&
    state.interestedPeople.length === 0
  );
}

// ─── Sync Provider ───────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: ReactNode }) {
  const completeSync = useStore((s) => s.completeSync);
  const importData = useStore((s) => s.importData);
  const autoSyncEnabled = useStore((s) => s.settings.autoSync);
  const hasPendingChanges = useStore((s) => s.syncMetadata.hasPendingChanges);

  const [state, setState] = useState<SyncState>({ status: "idle", error: null });
  const [isOnline, setIsOnline] = useState(true);
  const syncingRef = useRef(false);
  const autoSyncRef = useRef<() => void>(() => {});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPulledOnceRef = useRef(false);

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

  // ── performSync: push local state to Supabase ───────────────────────────

  const performSync = useCallback(async () => {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const store = useStore.getState();

    // SAFETY: Before pushing, check if remote has data but local is empty.
    // This prevents a fresh device from overwriting all data with empty state.
    const hasLocalData =
      store.serviceTypes.length > 0 ||
      store.timeEntries.length > 0 ||
      store.goals.length > 0 ||
      store.interestedPeople.length > 0;

    if (!hasLocalData && !hasPulledOnceRef.current) {
      console.info("[ServiceFlow] Push blocked: local data is empty and we haven't pulled yet. Pulling first...");
      try {
        const remote = await pullAll(userId);
        const remoteHasData =
          remote.serviceTypes.length > 0 ||
          remote.timeEntries.length > 0 ||
          remote.goals.length > 0 ||
          remote.interestedPeople.length > 0;

        if (remoteHasData) {
          importData(
            {
              version: 1 as const,
              exported_at: new Date().toISOString(),
              profile: remote.profile,
              settings: remote.settings,
              service_types: remote.serviceTypes,
              time_entries: remote.timeEntries,
              goals: remote.goals,
              interested_people: remote.interestedPeople,
              interested_statuses: remote.interestedStatuses,
            },
            { source: "remote" },
          );
          hasPulledOnceRef.current = true;
          console.info("[ServiceFlow] Pulled remote data to prevent overwrite");
          return; // Don't push — we just pulled
        }
      } catch (err) {
        console.warn("[ServiceFlow] Safety pull failed:", err instanceof Error ? err.message : err);
      }
    }

    const syncedAt = new Date().toISOString();

    console.info(`[ServiceFlow] Pushing to Supabase: ${store.serviceTypes.length} serviceTypes, ${store.timeEntries.length} entries, ${store.goals.length} goals, ${store.interestedPeople.length} interestedPeople`);

    await pushAll(
      {
        profile: store.profile,
        settings: { ...store.settings, lastSyncedAt: syncedAt },
        serviceTypes: store.serviceTypes,
        timeEntries: store.timeEntries,
        goals: store.goals,
        interestedPeople: store.interestedPeople,
        interestedStatuses: store.interestedStatuses,
      },
      userId,
    );

    hasPulledOnceRef.current = true;
    completeSync(syncedAt);
    // Flush microtask so Zustand persist writes lastSyncedAt to IndexedDB
    await new Promise((r) => setTimeout(r, 0));
  }, [completeSync, importData]);

  // ── syncNow: manual sync (push immediately) ─────────────────────────────

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      throw new Error("You are offline. Reconnect and try again.");
    }
    if (syncingRef.current) return;

    syncingRef.current = true;
    setState({ status: "syncing", error: null });

    try {
      await performSync();
      setState({ status: "idle", error: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sync failed");
      setState({ status: "error", error: error.message });
      throw error;
    } finally {
      syncingRef.current = false;
    }
  }, [performSync]);

  // ── autoSync: silent push (pending) or pull (no pending) ────────────────

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

    // Check if user is authenticated
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session?.user?.id) {
      console.info("[ServiceFlow] Auto-sync skipped: not authenticated");
      return;
    }

    console.info("[ServiceFlow] Auto-sync starting");
    syncingRef.current = true;
    try {
      // CRITICAL: Always pull first on a fresh device to prevent overwriting remote data
      if (!hasPulledOnceRef.current) {
        console.info("[ServiceFlow] First sync: pulling from Supabase before any push");
        try {
          const remote = await pullAll(session.user.id);
          hasPulledOnceRef.current = true;
          console.info(
            `[ServiceFlow] Pulled from Supabase: ${remote.serviceTypes.length} serviceTypes, ${remote.timeEntries.length} entries, ${remote.goals.length} goals, ${remote.interestedPeople.length} interestedPeople`,
          );

          const store = useStore.getState();
          const hasLocalData =
            store.serviceTypes.length > 0 ||
            store.timeEntries.length > 0 ||
            store.goals.length > 0 ||
            store.interestedPeople.length > 0;

          const remoteHasData =
            remote.serviceTypes.length > 0 ||
            remote.timeEntries.length > 0 ||
            remote.goals.length > 0 ||
            remote.interestedPeople.length > 0;

          if (remoteHasData) {
            // Remote has data — import it (this is the primary source of truth)
            importData(
              {
                version: 1 as const,
                exported_at: new Date().toISOString(),
                profile: remote.profile,
                settings: remote.settings,
                service_types: remote.serviceTypes,
                time_entries: remote.timeEntries,
                goals: remote.goals,
                interested_people: remote.interestedPeople,
                interested_statuses: remote.interestedStatuses,
              },
              { source: "remote" },
            );
            console.info("[ServiceFlow] First sync: imported remote data");
          } else if (hasLocalData) {
            // Remote is empty but local has data — push local data
            await performSync();
            console.info("[ServiceFlow] First sync: pushed local data (remote was empty)");
          }
        } catch (err) {
          console.warn("[ServiceFlow] First sync pull failed:", err instanceof Error ? err.message : err);
        }
        return;
      }

      // Subsequent syncs: normal push/pull logic
      if (hasPendingChanges) {
        // Upload local changes to Supabase
        await performSync();
        console.info("[ServiceFlow] Auto-sync: pushed changes to Supabase");
      } else {
        // No pending changes — pull from Supabase
        try {
          const remote = await pullAll(session.user.id);
          console.info(
            `[ServiceFlow] Pulled from Supabase: ${remote.serviceTypes.length} serviceTypes, ${remote.timeEntries.length} entries, ${remote.goals.length} goals, ${remote.interestedPeople.length} interestedPeople`,
          );

          const store = useStore.getState();
          const hasLocalData =
            store.serviceTypes.length > 0 ||
            store.timeEntries.length > 0 ||
            store.goals.length > 0 ||
            store.interestedPeople.length > 0;

          if (isRemoteEmpty(remote) && hasLocalData) {
            await performSync();
            console.info("[ServiceFlow] Auto-sync: pushed local data (remote was empty)");
          } else if (!isRemoteEmpty(remote)) {
            const remoteLastSynced = remote.settings?.lastSyncedAt ?? null;
            const localLastSynced = store.settings.lastSyncedAt;

            const shouldImport =
              !localLastSynced ||
              !remoteLastSynced ||
              new Date(remoteLastSynced) > new Date(localLastSynced);

            if (shouldImport) {
              importData(
                {
                  version: 1 as const,
                  exported_at: new Date().toISOString(),
                  profile: remote.profile,
                  settings: remote.settings,
                  service_types: remote.serviceTypes,
                  time_entries: remote.timeEntries,
                  goals: remote.goals,
                  interested_people: remote.interestedPeople,
                  interested_statuses: remote.interestedStatuses,
                },
                { source: "remote" },
              );
              console.info("[ServiceFlow] Auto-restore: applied newer data from Supabase");
            } else {
              console.info("[ServiceFlow] Auto-restore: local data is up to date");
            }
          } else {
            console.info("[ServiceFlow] Auto-restore: no remote data to restore");
          }
        } catch (err) {
          console.info(
            "[ServiceFlow] Auto-restore: pull failed or no data found",
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.warn(
        "[ServiceFlow] Auto-sync failed:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      syncingRef.current = false;
    }
  }, [autoSyncEnabled, hasPendingChanges, importData, performSync]);

  // Keep a ref to the latest autoSync so mount-only effects call current version.
  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  // Trigger: app open + tab becoming visible again.
  // Delayed on mount to wait for IndexedDB hydration.
  useEffect(() => {
    const initTimer = setTimeout(() => {
      autoSyncRef.current();
    }, 500);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        autoSyncRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(initTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
