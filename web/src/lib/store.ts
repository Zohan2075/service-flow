import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ServiceType,
  TimeEntry,
  UserProfile,
  AppSettings,
  BackupFile,
} from "@/types/data";

// ─── IndexedDB storage adapter for Zustand ──────────────────────────────────

function createIDBStorage() {
  const DB_NAME = "serviceflow";
  const STORE_NAME = "kv";
  const DB_VERSION = 1;

  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return createJSONStorage<AppState>(() => ({
    getItem: async (key: string): Promise<string | null> => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    setItem: async (key: string, value: string): Promise<void> => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    removeItem: async (key: string): Promise<void> => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  }));
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface AppState {
  // data
  profile: UserProfile | null;
  settings: AppSettings;
  serviceTypes: ServiceType[];
  timeEntries: TimeEntry[];
  syncMetadata: SyncMetadata;

  // auth actions
  setProfile: (p: UserProfile | null) => void;
  signOut: () => void;

  // settings / profile actions
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;

  // service type actions
  addServiceType: (st: Omit<ServiceType, "id" | "created_at" | "updated_at" | "sort_order" | "is_active">) => void;
  ensureDefaultServiceType: () => string;
  updateServiceType: (id: string, patch: Partial<ServiceType>) => void;
  moveServiceType: (id: string, direction: "up" | "down") => void;
  reorderServiceTypes: (orderedIds: string[]) => void;
  deleteServiceType: (id: string) => void;

  // time entry actions
  addTimeEntry: (entry: Omit<TimeEntry, "id" | "created_at" | "updated_at">) => void;
  updateTimeEntry: (id: string, patch: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;

  // bulk data actions (import / restore)
  importData: (file: BackupFile, options?: ImportDataOptions) => void;
  completeSync: (syncedAt: string, patch?: Partial<Pick<AppSettings, "autoSync">>) => void;
  resetData: () => void;
}

interface SyncMetadata {
  hasPendingChanges: boolean;
}

interface ImportDataOptions {
  source?: "local" | "remote";
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function sortServiceTypesByOrder(serviceTypes: ServiceType[]): ServiceType[] {
  return [...serviceTypes].sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeServiceTypes(serviceTypes: ServiceType[]): ServiceType[] {
  return [...serviceTypes]
    .map((serviceType, index) => ({
      ...serviceType,
      sort_order: index,
    }));
}

function createDefaultServiceType(
  language: AppSettings["language"],
  color: AppSettings["accentColor"],
  sortOrder: number
): ServiceType {
  const timestamp = now();

  return {
    id: uuid(),
    name: language === "es" ? "Por defecto" : "Default",
    description: null,
    color,
    icon: "category",
    sort_order: sortOrder,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function ensureServiceTypesNotEmpty(
  serviceTypes: ServiceType[],
  settings: Pick<AppSettings, "language" | "accentColor">
): ServiceType[] {
  if (serviceTypes.length > 0) {
    return normalizeServiceTypes(serviceTypes);
  }

  return normalizeServiceTypes([
    createDefaultServiceType(settings.language, settings.accentColor, 0),
  ]);
}

const SYNC_ONLY_SETTING_KEYS = new Set<keyof AppSettings>(["autoSync", "lastSyncedAt"]);

function getSyncComparableSettings(settings: AppSettings) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !SYNC_ONLY_SETTING_KEYS.has(key as keyof AppSettings))
  );
}

function hasSyncRelevantSettingsChange(patch: Partial<AppSettings>) {
  return Object.keys(patch).some((key) => !SYNC_ONLY_SETTING_KEYS.has(key as keyof AppSettings));
}

function createPendingSyncMetadata(): SyncMetadata {
  return { hasPendingChanges: true };
}

function withPendingSync<T extends object>(state: T): T & { syncMetadata: SyncMetadata } {
  return {
    ...state,
    syncMetadata: createPendingSyncMetadata(),
  };
}

const INITIAL_SETTINGS: AppSettings = {
  theme: "system",
  language: "en",
  accentColor: "#2094f3",
  customSurfaceLight: null,
  customSurfaceDark: null,
  customBackgroundLight: null,
  customBackgroundDark: null,
  weekStartsOn: "sunday",
  defaultEntryMode: "duration",
  defaultDurationHours: 1,
  defaultDurationMinutes: 0,
  autoSync: false,
  lastSyncedAt: null,
};

const INITIAL_SYNC_METADATA: SyncMetadata = {
  hasPendingChanges: false,
};

function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  const merged = { ...INITIAL_SETTINGS, ...(settings ?? {}) };
  const legacySurface = settings?.customSurface ?? null;
  const legacyBackground = settings?.customBackground ?? null;
  const rest = { ...merged };
  delete rest.customSurface;
  delete rest.customBackground;

  return {
    ...rest,
    customSurfaceLight: settings?.customSurfaceLight ?? legacySurface ?? rest.customSurfaceLight,
    customSurfaceDark: settings?.customSurfaceDark ?? legacySurface ?? rest.customSurfaceDark,
    customBackgroundLight: settings?.customBackgroundLight ?? legacyBackground ?? rest.customBackgroundLight,
    customBackgroundDark: settings?.customBackgroundDark ?? legacyBackground ?? rest.customBackgroundDark,
  };
}

function mergeImportedProfile(
  currentProfile: UserProfile | null,
  importedProfile: UserProfile | null
): UserProfile | null {
  if (!currentProfile) {
    return null;
  }

  if (!importedProfile) {
    return currentProfile;
  }

  const nextProfile: UserProfile = { ...currentProfile };

  if (Object.prototype.hasOwnProperty.call(importedProfile, "displayName")) {
    nextProfile.displayName = importedProfile.displayName ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(importedProfile, "bio")) {
    nextProfile.bio = importedProfile.bio ?? null;
  }

  return nextProfile;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      settings: INITIAL_SETTINGS,
      serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
      timeEntries: [],
      syncMetadata: INITIAL_SYNC_METADATA,

      // ── Auth ────────────────────────────────────────────────────────────
      setProfile: (p) =>
        set((s) => {
          const isAccountSwitch =
            p?.google_id &&
            s.profile?.google_id &&
            p.google_id !== s.profile.google_id;

          if (isAccountSwitch) {
            return {
              profile: p,
              settings: INITIAL_SETTINGS,
              serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
              timeEntries: [],
              syncMetadata: INITIAL_SYNC_METADATA,
            };
          }

          return { profile: p };
        }),

      signOut: () =>
        set({
          profile: null,
          settings: INITIAL_SETTINGS,
          serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
          timeEntries: [],
          syncMetadata: INITIAL_SYNC_METADATA,
        }),

      // ── Settings / Profile ──────────────────────────────────────────────
      updateSettings: (patch) =>
        set((s) => {
          const nextSettings = normalizeSettings({ ...s.settings, ...patch });
          const changed =
            JSON.stringify(getSyncComparableSettings(nextSettings)) !==
            JSON.stringify(getSyncComparableSettings(s.settings));

          if (changed && hasSyncRelevantSettingsChange(patch)) {
            return withPendingSync({ settings: nextSettings });
          }

          return { settings: nextSettings };
        }),
      updateProfile: (patch) =>
        set((s) => ({
          ...(s.profile
            ? withPendingSync({ profile: { ...s.profile, ...patch } })
            : { profile: null }),
        })),

      // ── Service Types ───────────────────────────────────────────────────
      addServiceType: (st) =>
        set((s) =>
          withPendingSync({
            serviceTypes: ensureServiceTypesNotEmpty([
              ...s.serviceTypes,
              {
                ...st,
                id: uuid(),
                sort_order: s.serviceTypes.length,
                is_active: true,
                created_at: now(),
                updated_at: now(),
              },
            ], s.settings),
          })
        ),

      ensureDefaultServiceType: () => {
        const existing = get().serviceTypes[0];
        if (existing) return existing.id;

        set((s) =>
          withPendingSync({
            serviceTypes: ensureServiceTypesNotEmpty(s.serviceTypes, s.settings),
          })
        );

        return get().serviceTypes[0]?.id ?? "";
      },

      updateServiceType: (id, patch) =>
        set((s) =>
          withPendingSync({
            serviceTypes: normalizeServiceTypes(
              s.serviceTypes.map((st) =>
                st.id === id ? { ...st, ...patch, updated_at: now() } : st
              )
            ),
          })
        ),

      moveServiceType: (id, direction) =>
        set((s) => {
          const sorted = normalizeServiceTypes(s.serviceTypes);
          const currentIndex = sorted.findIndex((serviceType) => serviceType.id === id);

          if (currentIndex === -1) {
            return { serviceTypes: sorted };
          }

          const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= sorted.length) {
            return { serviceTypes: sorted };
          }

          const reordered = [...sorted];
          [reordered[currentIndex], reordered[targetIndex]] = [
            { ...reordered[targetIndex], updated_at: now() },
            { ...reordered[currentIndex], updated_at: now() },
          ];

          return withPendingSync({ serviceTypes: normalizeServiceTypes(reordered) });
        }),

      reorderServiceTypes: (orderedIds) =>
        set((s) => {
          const serviceTypeMap = new Map(
            s.serviceTypes.map((serviceType) => [serviceType.id, serviceType])
          );

          const reordered = orderedIds
            .map((id) => serviceTypeMap.get(id))
            .filter((serviceType): serviceType is ServiceType => Boolean(serviceType))
            .map((serviceType) => ({ ...serviceType, updated_at: now() }));

          const missing = s.serviceTypes
            .filter((serviceType) => !orderedIds.includes(serviceType.id))
            .map((serviceType) => ({ ...serviceType, updated_at: now() }));

          return {
            ...withPendingSync({
              serviceTypes: normalizeServiceTypes([...reordered, ...missing]),
            }),
          };
        }),

      deleteServiceType: (id) =>
        set((s) => {
          if (s.serviceTypes.length <= 1) return s;
          return withPendingSync({
            serviceTypes: normalizeServiceTypes(
              s.serviceTypes.filter((st) => st.id !== id)
            ),
          });
        }),

      // ── Time Entries ────────────────────────────────────────────────────
      addTimeEntry: (entry) =>
        set((s) => {
          const serviceTypes = ensureServiceTypesNotEmpty(s.serviceTypes, s.settings);
          const idExists = serviceTypes.some((st) => st.id === entry.service_type_id);
          const serviceTypeId = idExists ? entry.service_type_id : serviceTypes[0].id;

          return withPendingSync({
            serviceTypes,
            timeEntries: [
              ...s.timeEntries,
              {
                ...entry,
                service_type_id: serviceTypeId,
                id: uuid(),
                created_at: now(),
                updated_at: now(),
              },
            ],
          });
        }),

      updateTimeEntry: (id, patch) =>
        set((s) =>
          withPendingSync({
            timeEntries: s.timeEntries.map((te) =>
              te.id === id ? { ...te, ...patch, updated_at: now() } : te
            ),
          })
        ),

      deleteTimeEntry: (id) =>
        set((s) =>
          withPendingSync({
            timeEntries: s.timeEntries.filter((te) => te.id !== id),
          })
        ),

      // ── Bulk ───────────────────────────────────────────────────────────
      importData: (file, options) =>
        set((s) => {
          const settings = normalizeSettings({ ...s.settings, ...(file.settings ?? {}) });

          return {
            settings,
            profile: mergeImportedProfile(s.profile, file.profile),
            serviceTypes: ensureServiceTypesNotEmpty(
              sortServiceTypesByOrder(file.service_types),
              settings
            ),
            timeEntries: file.time_entries,
            syncMetadata:
              options?.source === "remote"
                ? INITIAL_SYNC_METADATA
                : createPendingSyncMetadata(),
          };
        }),

      completeSync: (syncedAt, patch) =>
        set((s) => ({
          settings: normalizeSettings({
            ...s.settings,
            ...(patch ?? {}),
            lastSyncedAt: syncedAt,
          }),
          syncMetadata: INITIAL_SYNC_METADATA,
        })),

      resetData: () =>
        set(
          withPendingSync({
            profile: null,
            settings: INITIAL_SETTINGS,
            serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
            timeEntries: [],
          })
        ),
    }),
    {
      name: "serviceflow-data",
      storage: typeof window !== "undefined" ? createIDBStorage() : undefined,
      // Only persist data fields, not actions
      partialize: (state) => ({
        profile: state.profile,
        settings: state.settings,
        serviceTypes: state.serviceTypes,
        timeEntries: state.timeEntries,
        syncMetadata: state.syncMetadata,
      }) as unknown as AppState,
      // Deep-merge settings so new fields get their defaults when loading old data
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const settings = normalizeSettings({ ...current.settings, ...(p.settings ?? {}) });
        return {
          ...current,
          ...p,
          settings,
          serviceTypes: ensureServiceTypesNotEmpty(
            sortServiceTypesByOrder(p.serviceTypes ?? current.serviceTypes),
            settings
          ),
          syncMetadata: p.syncMetadata ?? current.syncMetadata,
        };
      },
    }
  )
);

// ─── Serializer (single source of truth for JSON format) ─────────────────────

export function serializeBackup(state: {
  profile: UserProfile | null;
  settings: AppSettings;
  serviceTypes: ServiceType[];
  timeEntries: TimeEntry[];
}): BackupFile {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: state.profile,
    settings: state.settings,
    service_types: state.serviceTypes,
    time_entries: state.timeEntries,
  };
}

export function deserializeBackup(raw: unknown): BackupFile {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid backup file: not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error(`Unsupported backup version: ${obj.version}`);
  }
  if (!Array.isArray(obj.service_types) || !Array.isArray(obj.time_entries)) {
    throw new Error("Invalid backup file: missing data arrays");
  }
  return obj as unknown as BackupFile;
}
