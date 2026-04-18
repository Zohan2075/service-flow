import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ServiceType,
  TimeEntry,
  UserProfile,
  AppSettings,
  BackupFile,
  GoalDefinition,
  GoalScope,
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
  goals: GoalDefinition[];
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

  // goal actions
  addGoal: (goal: Omit<GoalDefinition, "id" | "created_at" | "updated_at">) => void;
  updateGoal: (id: string, patch: Partial<GoalDefinition>) => void;
  deleteGoal: (id: string) => void;

  // bulk data actions (import / restore)
  importData: (file: BackupFile, options?: ImportDataOptions) => void;
  completeSync: (syncedAt: string) => void;
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

const SYNC_ONLY_SETTING_KEYS = new Set<keyof AppSettings>(["lastSyncedAt"]);

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
  showYearTotals: false,
  lastSyncedAt: null,
};

const INITIAL_SYNC_METADATA: SyncMetadata = {
  hasPendingChanges: false,
};

function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  // Strip legacy fields that may come from old backups
  const input = { ...(settings ?? {}) } as Record<string, unknown>;
  delete input.autoSync;

  const merged = { ...INITIAL_SETTINGS, ...input };
  const legacySurface = (input.customSurface as string | null) ?? null;
  const legacyBackground = (input.customBackground as string | null) ?? null;
  const rest = { ...merged };
  delete rest.customSurface;
  delete rest.customBackground;

  return {
    ...rest,
    customSurfaceLight: (settings?.customSurfaceLight as string | null) ?? legacySurface ?? rest.customSurfaceLight,
    customSurfaceDark: (settings?.customSurfaceDark as string | null) ?? legacySurface ?? rest.customSurfaceDark,
    customBackgroundLight: (settings?.customBackgroundLight as string | null) ?? legacyBackground ?? rest.customBackgroundLight,
    customBackgroundDark: (settings?.customBackgroundDark as string | null) ?? legacyBackground ?? rest.customBackgroundDark,
  };
}

function normalizeTimeEntry(entry: TimeEntry): TimeEntry {
  return {
    ...entry,
    units_quantity: entry.units_quantity ?? null,
    units_label: entry.units_label ?? null,
  };
}

function normalizeGoalNumber(value: unknown, options?: { integer?: boolean }) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return options?.integer ? Math.floor(value) : Math.round(value);
}

function hasGoalTargets(goal: Pick<GoalDefinition, "monthly_duration_seconds" | "monthly_units_quantity" | "yearly_duration_seconds" | "yearly_units_quantity">) {
  return Boolean(
    goal.monthly_duration_seconds ||
    goal.monthly_units_quantity ||
    goal.yearly_duration_seconds ||
    goal.yearly_units_quantity
  );
}

function normalizeGoal(
  goal: Partial<GoalDefinition>,
  validServiceTypeIds?: Set<string>
): GoalDefinition | null {
  const scope: GoalScope = goal.scope === "combined" ? "combined" : "service";
  const monthly_duration_seconds = normalizeGoalNumber(goal.monthly_duration_seconds);
  const monthly_units_quantity = normalizeGoalNumber(goal.monthly_units_quantity, { integer: true });
  const yearly_duration_seconds = normalizeGoalNumber(goal.yearly_duration_seconds);
  const yearly_units_quantity = normalizeGoalNumber(goal.yearly_units_quantity, { integer: true });

  const baseGoal = {
    id: typeof goal.id === "string" && goal.id ? goal.id : uuid(),
    name: typeof goal.name === "string" ? goal.name.trim() || null : null,
    scope,
    monthly_duration_seconds,
    monthly_units_quantity,
    yearly_duration_seconds,
    yearly_units_quantity,
    created_at: typeof goal.created_at === "string" ? goal.created_at : now(),
    updated_at: typeof goal.updated_at === "string" ? goal.updated_at : now(),
  } satisfies Omit<GoalDefinition, "service_type_id" | "service_type_ids">;

  if (!hasGoalTargets(baseGoal)) {
    return null;
  }

  if (scope === "service") {
    const serviceTypeId = typeof goal.service_type_id === "string" ? goal.service_type_id : null;
    if (!serviceTypeId || (validServiceTypeIds && !validServiceTypeIds.has(serviceTypeId))) {
      return null;
    }

    return {
      ...baseGoal,
      name: null,
      service_type_id: serviceTypeId,
      service_type_ids: [],
    };
  }

  const nextServiceTypeIds = Array.isArray(goal.service_type_ids)
    ? [...new Set(goal.service_type_ids.filter((id): id is string => typeof id === "string"))]
    : [];
  const filteredServiceTypeIds = validServiceTypeIds
    ? nextServiceTypeIds.filter((id) => validServiceTypeIds.has(id))
    : nextServiceTypeIds;

  if (filteredServiceTypeIds.length === 0) {
    return null;
  }

  return {
    ...baseGoal,
    service_type_id: null,
    service_type_ids: filteredServiceTypeIds,
  };
}

function normalizeGoals(goals: GoalDefinition[] | undefined, validServiceTypeIds?: Set<string>) {
  return (goals ?? []).reduce<GoalDefinition[]>((normalizedGoals, goal) => {
    const normalizedGoal = normalizeGoal(goal, validServiceTypeIds);
    if (normalizedGoal) {
      normalizedGoals.push(normalizedGoal);
    }
    return normalizedGoals;
  }, []);
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
      goals: [],
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
              goals: [],
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
          goals: [],
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

          const nextServiceTypes = normalizeServiceTypes(
            s.serviceTypes.filter((st) => st.id !== id)
          );
          const validServiceTypeIds = new Set(nextServiceTypes.map((serviceType) => serviceType.id));

          return withPendingSync({
            serviceTypes: nextServiceTypes,
            goals: normalizeGoals(
              s.goals
                .filter((goal) => !(goal.scope === "service" && goal.service_type_id === id))
                .map((goal) =>
                  goal.scope === "combined"
                    ? { ...goal, service_type_ids: goal.service_type_ids.filter((serviceTypeId) => serviceTypeId !== id) }
                    : goal
                ),
              validServiceTypeIds
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

      // ── Goals ───────────────────────────────────────────────────────────
      addGoal: (goal) =>
        set((s) => {
          const validServiceTypeIds = new Set(s.serviceTypes.map((serviceType) => serviceType.id));
          const normalizedGoal = normalizeGoal(
            {
              ...goal,
              id: uuid(),
              created_at: now(),
              updated_at: now(),
            },
            validServiceTypeIds
          );

          if (!normalizedGoal) {
            return { goals: s.goals };
          }

          return withPendingSync({
            goals: [...s.goals, normalizedGoal],
          });
        }),

      updateGoal: (id, patch) =>
        set((s) => {
          const currentGoal = s.goals.find((goal) => goal.id === id);
          if (!currentGoal) {
            return { goals: s.goals };
          }

          const validServiceTypeIds = new Set(s.serviceTypes.map((serviceType) => serviceType.id));
          const normalizedGoal = normalizeGoal(
            {
              ...currentGoal,
              ...patch,
              id: currentGoal.id,
              created_at: currentGoal.created_at,
              updated_at: now(),
            },
            validServiceTypeIds
          );

          if (!normalizedGoal) {
            return withPendingSync({
              goals: s.goals.filter((goal) => goal.id !== id),
            });
          }

          return withPendingSync({
            goals: s.goals.map((goal) => (goal.id === id ? normalizedGoal : goal)),
          });
        }),

      deleteGoal: (id) =>
        set((s) =>
          withPendingSync({
            goals: s.goals.filter((goal) => goal.id !== id),
          })
        ),

      // ── Bulk ───────────────────────────────────────────────────────────
      importData: (file, options) =>
        set((s) => {
          const settings = normalizeSettings({ ...s.settings, ...(file.settings ?? {}) });
          const serviceTypes = ensureServiceTypesNotEmpty(
            sortServiceTypesByOrder(file.service_types),
            settings
          );
          const validServiceTypeIds = new Set(serviceTypes.map((serviceType) => serviceType.id));

          return {
            settings,
            profile: mergeImportedProfile(s.profile, file.profile),
            serviceTypes,
            timeEntries: (file.time_entries ?? []).map(normalizeTimeEntry),
            goals: normalizeGoals(file.goals, validServiceTypeIds),
            syncMetadata:
              options?.source === "remote"
                ? INITIAL_SYNC_METADATA
                : createPendingSyncMetadata(),
          };
        }),

      completeSync: (syncedAt) =>
        set((s) => ({
          settings: normalizeSettings({
            ...s.settings,
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
            goals: [],
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
        goals: state.goals,
        syncMetadata: state.syncMetadata,
      }) as unknown as AppState,
      // Deep-merge settings so new fields get their defaults when loading old data
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const settings = normalizeSettings({ ...current.settings, ...(p.settings ?? {}) });
        const serviceTypes = ensureServiceTypesNotEmpty(
          sortServiceTypesByOrder(p.serviceTypes ?? current.serviceTypes),
          settings
        );
        const validServiceTypeIds = new Set(serviceTypes.map((serviceType) => serviceType.id));
        return {
          ...current,
          ...p,
          settings,
          serviceTypes,
          timeEntries: (p.timeEntries ?? current.timeEntries).map(normalizeTimeEntry),
          goals: normalizeGoals(p.goals ?? current.goals, validServiceTypeIds),
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
  goals?: GoalDefinition[];
}): BackupFile {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: state.profile,
    settings: state.settings,
    service_types: state.serviceTypes,
    time_entries: state.timeEntries,
    goals: state.goals ?? [],
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
  if (Object.prototype.hasOwnProperty.call(obj, "goals") && !Array.isArray(obj.goals)) {
    throw new Error("Invalid backup file: goals must be an array");
  }
  return obj as unknown as BackupFile;
}
