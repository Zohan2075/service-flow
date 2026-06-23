import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addMonths, startOfMonth } from "date-fns";
import type {
  ServiceType,
  TimeEntry,
  UserProfile,
  AppSettings,
  BackupFile,
  GoalDefinition,
  GoalScope,
  InterestedPerson,
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
  interestedPeople: InterestedPerson[];
  syncMetadata: SyncMetadata;
  uiState: UiState;

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

  // interested person actions
  addInterestedPerson: (person: Omit<InterestedPerson, "id" | "created_at" | "updated_at">) => void;
  updateInterestedPerson: (id: string, patch: Partial<InterestedPerson>) => void;
  deleteInterestedPerson: (id: string) => void;

  // transient navigation state
  setViewedMonth: (date: Date) => void;
  goToPreviousViewedMonth: () => void;
  goToNextViewedMonth: () => void;
  goToToday: () => void;

  // bulk data actions (import / restore)
  importData: (file: BackupFile, options?: ImportDataOptions) => void;
  completeSync: (syncedAt: string) => void;
  resetData: () => void;
}

interface SyncMetadata {
  hasPendingChanges: boolean;
}

interface UiState {
  viewedMonth: Date;
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

function normalizeEntryType(entryType: unknown): ServiceType["entry_type"] {
  return entryType === "units" ? "units" : "time";
}

function normalizeServiceTypes(serviceTypes: ServiceType[]): ServiceType[] {
  return [...serviceTypes]
    .map((serviceType, index) => ({
      ...serviceType,
      entry_type: normalizeEntryType(serviceType.entry_type),
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
    entry_type: "time",
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

const SYNC_ONLY_SETTING_KEYS = new Set<keyof AppSettings>(["lastSyncedAt", "autoSync"]);

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
  planModeEnabled: false,
  showYearTotals: true,
  autoSync: true,
  lastSyncedAt: null,
};

const INITIAL_SYNC_METADATA: SyncMetadata = {
  hasPendingChanges: false,
};

const INITIAL_UI_STATE: UiState = {
  viewedMonth: startOfMonth(new Date()),
};

function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  const input = { ...(settings ?? {}) } as Record<string, unknown>;

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
    is_planned: entry.is_planned ?? false,
  };
}

function normalizeProfileImage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizePersistedProfile(profile: UserProfile | null | undefined): UserProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    image: normalizeProfileImage(profile.image),
    displayName: profile.displayName ?? null,
    bio: profile.bio ?? null,
    customImage: normalizeProfileImage(profile.customImage),
  };
}

function mergeLiveProfile(currentProfile: UserProfile | null, incomingProfile: UserProfile): UserProfile {
  const nextProfile: UserProfile = {
    google_id: incomingProfile.google_id,
    name: incomingProfile.name,
    email: incomingProfile.email,
    image: normalizeProfileImage(incomingProfile.image),
    displayName: currentProfile?.displayName ?? null,
    bio: currentProfile?.bio ?? null,
    customImage: currentProfile?.customImage ?? null,
  };

  if (Object.prototype.hasOwnProperty.call(incomingProfile, "displayName")) {
    nextProfile.displayName = incomingProfile.displayName ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(incomingProfile, "bio")) {
    nextProfile.bio = incomingProfile.bio ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(incomingProfile, "customImage")) {
    nextProfile.customImage = normalizeProfileImage(incomingProfile.customImage);
  }

  return nextProfile;
}

function resolveEntryTitle(title: unknown, serviceTypeId: string, serviceTypes: ServiceType[]) {
  const trimmedTitle = typeof title === "string" ? title.trim() : "";

  if (trimmedTitle) {
    return trimmedTitle;
  }

  return serviceTypes.find((serviceType) => serviceType.id === serviceTypeId)?.name ?? "Entry";
}

function normalizeViewedMonth(date: Date) {
  return startOfMonth(date);
}

function normalizeGoalNumber(value: unknown, options?: { integer?: boolean }) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return options?.integer ? Math.floor(value) : Math.round(value);
}

function normalizeGoalStartMonth(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 9;
  }

  const month = Math.floor(value);
  return month >= 1 && month <= 12 ? month : 9;
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
  serviceTypeMap?: Map<string, ServiceType>
): GoalDefinition | null {
  const scope: GoalScope = goal.scope === "combined" ? "combined" : "service";
  const monthly_duration_seconds = normalizeGoalNumber(goal.monthly_duration_seconds);
  const monthly_units_quantity = normalizeGoalNumber(goal.monthly_units_quantity, { integer: true });
  const yearly_duration_seconds = normalizeGoalNumber(goal.yearly_duration_seconds);
  const yearly_units_quantity = normalizeGoalNumber(goal.yearly_units_quantity, { integer: true });
  const yearly_start_month = normalizeGoalStartMonth(goal.yearly_start_month);
  const normalizedName = typeof goal.name === "string" ? goal.name.trim() : "";

  const baseGoal = {
    id: typeof goal.id === "string" && goal.id ? goal.id : uuid(),
    name: normalizedName || "Goal",
    scope,
    monthly_duration_seconds,
    monthly_units_quantity,
    yearly_duration_seconds,
    yearly_units_quantity,
    yearly_start_month,
    created_at: typeof goal.created_at === "string" ? goal.created_at : now(),
    updated_at: typeof goal.updated_at === "string" ? goal.updated_at : now(),
  } satisfies Omit<GoalDefinition, "service_type_id" | "service_type_ids">;

  if (!hasGoalTargets(baseGoal)) {
    return null;
  }

  if (scope === "service") {
    const serviceTypeId = typeof goal.service_type_id === "string" ? goal.service_type_id : null;
    const serviceType = serviceTypeId ? serviceTypeMap?.get(serviceTypeId) : undefined;

    if (!serviceTypeId || (serviceTypeMap && !serviceType)) {
      return null;
    }

    return {
      ...baseGoal,
      name: normalizedName || serviceType?.name || baseGoal.name,
      service_type_id: serviceTypeId,
      service_type_ids: [],
    };
  }

  const nextServiceTypeIds = Array.isArray(goal.service_type_ids)
    ? [...new Set(goal.service_type_ids.filter((id): id is string => typeof id === "string"))]
    : [];
  const filteredServiceTypeIds = serviceTypeMap
    ? nextServiceTypeIds.filter((id) => serviceTypeMap.has(id))
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

function normalizeGoals(goals: GoalDefinition[] | undefined, serviceTypeMap?: Map<string, ServiceType>) {
  return (goals ?? []).reduce<GoalDefinition[]>((normalizedGoals, goal) => {
    const normalizedGoal = normalizeGoal(goal, serviceTypeMap);
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

  if (Object.prototype.hasOwnProperty.call(importedProfile, "customImage")) {
    nextProfile.customImage = normalizeProfileImage(importedProfile.customImage);
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
      interestedPeople: [],
      syncMetadata: INITIAL_SYNC_METADATA,
      uiState: INITIAL_UI_STATE,

      // ── Auth ────────────────────────────────────────────────────────────
      setProfile: (p) =>
        set((s) => {
          const isAccountSwitch =
            p?.google_id &&
            s.profile?.google_id &&
            p.google_id !== s.profile.google_id;

          const nextProfile = p
            ? mergeLiveProfile(isAccountSwitch ? null : s.profile, p)
            : null;

          if (isAccountSwitch) {
            return {
              profile: nextProfile,
              settings: INITIAL_SETTINGS,
              serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
              timeEntries: [],
              goals: [],
              interestedPeople: [],
              syncMetadata: INITIAL_SYNC_METADATA,
              uiState: INITIAL_UI_STATE,
            };
          }

          return { profile: nextProfile };
        }),

      signOut: () =>
        set({
          profile: null,
          settings: INITIAL_SETTINGS,
          serviceTypes: ensureServiceTypesNotEmpty([], INITIAL_SETTINGS),
          timeEntries: [],
          goals: [],
          interestedPeople: [],
          syncMetadata: INITIAL_SYNC_METADATA,
          uiState: INITIAL_UI_STATE,
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
        set((s) => {
          if (!s.profile) {
            return { profile: null };
          }

          const nextProfile: UserProfile = {
            ...s.profile,
            ...patch,
          };

          if (Object.prototype.hasOwnProperty.call(patch, "customImage")) {
            nextProfile.customImage = normalizeProfileImage(patch.customImage);
          }

          return withPendingSync({ profile: nextProfile });
        }),

      // ── Service Types ───────────────────────────────────────────────────
      addServiceType: (st) =>
        set((s) =>
          withPendingSync({
            serviceTypes: ensureServiceTypesNotEmpty([
              ...s.serviceTypes,
              {
                ...st,
                entry_type: normalizeEntryType(st.entry_type),
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
          const nextServiceTypeMap = new Map(nextServiceTypes.map((serviceType) => [serviceType.id, serviceType]));

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
              nextServiceTypeMap
            ),
          });
        }),

      // ── Time Entries ────────────────────────────────────────────────────
      addTimeEntry: (entry) =>
        set((s) => {
          const serviceTypes = ensureServiceTypesNotEmpty(s.serviceTypes, s.settings);
          const idExists = serviceTypes.some((st) => st.id === entry.service_type_id);
          const serviceTypeId = idExists ? entry.service_type_id : serviceTypes[0].id;
          const title = resolveEntryTitle(entry.title, serviceTypeId, serviceTypes);

          return withPendingSync({
            serviceTypes,
            timeEntries: [
              ...s.timeEntries,
              {
                ...entry,
                title,
                service_type_id: serviceTypeId,
                id: uuid(),
                created_at: now(),
                updated_at: now(),
              },
            ],
          });
        }),

      updateTimeEntry: (id, patch) =>
        set((s) => {
          const serviceTypes = ensureServiceTypesNotEmpty(s.serviceTypes, s.settings);

          return withPendingSync({
            serviceTypes,
            timeEntries: s.timeEntries.map((timeEntry) => {
              if (timeEntry.id !== id) {
                return timeEntry;
              }

              const requestedServiceTypeId = typeof patch.service_type_id === "string"
                ? patch.service_type_id
                : timeEntry.service_type_id;
              const nextServiceTypeId = serviceTypes.some((serviceType) => serviceType.id === requestedServiceTypeId)
                ? requestedServiceTypeId
                : serviceTypes[0].id;

              return {
                ...timeEntry,
                ...patch,
                title: resolveEntryTitle(patch.title ?? timeEntry.title, nextServiceTypeId, serviceTypes),
                service_type_id: nextServiceTypeId,
                updated_at: now(),
              };
            }),
          });
        }),

      deleteTimeEntry: (id) =>
        set((s) =>
          withPendingSync({
            timeEntries: s.timeEntries.filter((te) => te.id !== id),
          })
        ),

      // ── Goals ───────────────────────────────────────────────────────────
      addGoal: (goal) =>
        set((s) => {
          const serviceTypeMap = new Map(s.serviceTypes.map((serviceType) => [serviceType.id, serviceType]));
          const normalizedGoal = normalizeGoal(
            {
              ...goal,
              id: uuid(),
              created_at: now(),
              updated_at: now(),
            },
            serviceTypeMap
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

          const serviceTypeMap = new Map(s.serviceTypes.map((serviceType) => [serviceType.id, serviceType]));
          const normalizedGoal = normalizeGoal(
            {
              ...currentGoal,
              ...patch,
              id: currentGoal.id,
              created_at: currentGoal.created_at,
              updated_at: now(),
            },
            serviceTypeMap
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

      // ── Interested People ──────────────────────────────────────────────
      addInterestedPerson: (person) =>
        set((s) =>
          withPendingSync({
            interestedPeople: [
              ...s.interestedPeople,
              {
                ...person,
                id: uuid(),
                created_at: now(),
                updated_at: now(),
              },
            ],
          })
        ),

      updateInterestedPerson: (id, patch) =>
        set((s) =>
          withPendingSync({
            interestedPeople: s.interestedPeople.map((person) =>
              person.id === id
                ? { ...person, ...patch, updated_at: now() }
                : person
            ),
          })
        ),

      deleteInterestedPerson: (id) =>
        set((s) =>
          withPendingSync({
            interestedPeople: s.interestedPeople.filter((person) => person.id !== id),
          })
        ),

      // ── Transient Month Navigation ────────────────────────────────────
      setViewedMonth: (date) =>
        set({
          uiState: {
            viewedMonth: normalizeViewedMonth(date),
          },
        }),

      goToPreviousViewedMonth: () =>
        set((s) => ({
          uiState: {
            viewedMonth: addMonths(s.uiState.viewedMonth, -1),
          },
        })),

      goToNextViewedMonth: () =>
        set((s) => ({
          uiState: {
            viewedMonth: addMonths(s.uiState.viewedMonth, 1),
          },
        })),

      goToToday: () =>
        set({
          uiState: {
            viewedMonth: startOfMonth(new Date()),
          },
        }),

      // ── Bulk ───────────────────────────────────────────────────────────
      importData: (file, options) =>
        set((s) => {
          const settings = normalizeSettings({ ...s.settings, ...(file.settings ?? {}) });
          const serviceTypes = ensureServiceTypesNotEmpty(
            sortServiceTypesByOrder(file.service_types),
            settings
          );
          const serviceTypeMap = new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));

          return {
            settings,
            profile: mergeImportedProfile(s.profile, file.profile),
            serviceTypes,
            timeEntries: (file.time_entries ?? []).map(normalizeTimeEntry),
            goals: normalizeGoals(file.goals, serviceTypeMap),
            interestedPeople: file.interested_people ?? [],
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
            interestedPeople: [],
            uiState: INITIAL_UI_STATE,
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
        interestedPeople: state.interestedPeople,
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
        const serviceTypeMap = new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));
        return {
          ...current,
          ...p,
          profile: normalizePersistedProfile(p.profile ?? current.profile),
          settings,
          serviceTypes,
          timeEntries: (p.timeEntries ?? current.timeEntries).map(normalizeTimeEntry),
          goals: normalizeGoals(p.goals ?? current.goals, serviceTypeMap),
          interestedPeople: p.interestedPeople ?? current.interestedPeople,
          syncMetadata: p.syncMetadata ?? current.syncMetadata,
          uiState: current.uiState,
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
  interestedPeople?: InterestedPerson[];
}): BackupFile {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: state.profile,
    settings: state.settings,
    service_types: state.serviceTypes,
    time_entries: state.timeEntries,
    goals: state.goals ?? [],
    interested_people: state.interestedPeople ?? [],
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
