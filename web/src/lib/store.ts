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
  InterestedStatusConfig,
  NotificationPreferences,
} from "@/types/data";
import { DEFAULT_INTERESTED_STATUSES } from "@/types/data";
import { isoWeekKey, isInterestedPersonCompleted } from "@/lib/isoWeek";
import type {
  PresidingConfig,
  PresidingPrefs,
  PresidingSection,
  ProgramWeek,
  SectionGroup,
  MeetingSession,
  TimerLogEntry,
  ProgramTombstone,
} from "@/types/presiding";
import {
  getDefaultPresidingConfig,
  getDefaultPresidingPrefs,
  getTimerRoles,
  getProgramWeekId,
  getJwWolWeekCatalogEntry,
} from "@/types/presiding";
import type {
  CommentsConfig,
  CommentBox,
} from "@/types/comments";
import {
  getDefaultCommentsConfig,
  newCommentId,
} from "@/types/comments";

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
  interestedStatuses: InterestedStatusConfig[];
  syncMetadata: SyncMetadata;
  uiState: UiState;

// presiding
  presidingConfig: PresidingConfig;
  presidingPrefs: PresidingPrefs;
  presidingSession: MeetingSession | null;
  presidingSessions: MeetingSession[];
  presidingTombstones: ProgramTombstone[];

  // comments
  commentsConfig: CommentsConfig;

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
  toggleInterestedPersonCompleted: (id: string) => void;
  deleteInterestedPerson: (id: string) => void;

  // interested status config actions
  addInterestedStatus: (name: string, color: string, icon: string) => string;
  deleteInterestedStatus: (id: string) => { reassignedTo: string; affectedCount: number } | null;
  updateInterestedStatus: (id: string, patch: Partial<InterestedStatusConfig>) => void;
  reorderInterestedStatuses: (orderedIds: string[]) => void;

  // transient navigation state
  setViewedMonth: (date: Date) => void;
  goToPreviousViewedMonth: () => void;
  goToNextViewedMonth: () => void;
  goToToday: () => void;

  // bulk data actions (import / restore)
  importData: (file: BackupFile, options?: ImportDataOptions) => void;
  completeSync: (syncedAt: string) => void;
  resetData: () => void;

  // presiding actions
  setPresidingConfig: (cfg: PresidingConfig) => void;
  setPresidingPrefs: (patch: Partial<PresidingPrefs>) => void;
  startPresidingSession: () => void;
  addPresidingLogEntry: (entry: TimerLogEntry) => void;
  updatePresidingLogEntry: (logId: string, patch: Partial<TimerLogEntry>) => void;
  deletePresidingLogEntry: (logId: string) => void;
resetPresidingConfig: () => void;
  ensureActiveProgramWeek: (date?: Date) => void;

  // comments actions
  setCommentsConfig: (cfg: CommentsConfig) => void;
  updateCommentBox: (weekId: string, boxId: string, patch: Partial<CommentsConfig["boxesByWeek"][string][number]>) => void;
  resetCommentsConfig: () => void;
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

interface RemoteProgramPayload {
  config?: unknown;
  prefs?: Partial<PresidingPrefs>;
  sessions?: unknown[];
  tombstones?: unknown[];
}

interface RemoteCommentsPayload {
  config?: unknown;
}

function migrateProgramTombstones(raw: unknown): ProgramTombstone[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const item = value as Partial<ProgramTombstone>;
    if (
      (item.entityType !== "week" && item.entityType !== "intervention" && item.entityType !== "session" && item.entityType !== "log") ||
      typeof item.entityKey !== "string" ||
      typeof item.deletedAt !== "string"
    ) return [];
    return [{
      entityType: item.entityType,
      entityKey: item.entityKey,
      deletedAt: item.deletedAt,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : item.deletedAt,
    } satisfies ProgramTombstone];
  });
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
    cap_exempt: false,
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
  notifications: {
    enabled: false,
    advanceDays: 1,
    frequencyMinutes: 30,
    sound: "off",
    showPreview: false,
  },
  interestedCommentsTimestampShortcutEnabled: true,
  interestedCommentsTimestampFormat: "12h",
  autoSync: true,
  monthlyCapEnabled: false,
  monthlyCapHours: 55,
  programEnabled: false,
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

  const rawNotifications = input.notifications as Partial<NotificationPreferences> | undefined;
  const notificationSounds = new Set(["off", "soft", "chime", "alert"]);
  const notifications = {
    ...INITIAL_SETTINGS.notifications,
    ...(rawNotifications ?? {}),
    enabled: rawNotifications?.enabled === true,
    advanceDays: typeof rawNotifications?.advanceDays === "number" && Number.isFinite(rawNotifications.advanceDays)
      ? Math.min(30, Math.max(0, Math.floor(rawNotifications.advanceDays)))
      : INITIAL_SETTINGS.notifications.advanceDays,
    frequencyMinutes: typeof rawNotifications?.frequencyMinutes === "number" && Number.isFinite(rawNotifications.frequencyMinutes)
      ? Math.min(1440, Math.max(5, Math.floor(rawNotifications.frequencyMinutes)))
      : INITIAL_SETTINGS.notifications.frequencyMinutes,
    sound: typeof rawNotifications?.sound === "string" && notificationSounds.has(rawNotifications.sound)
      ? rawNotifications.sound as NotificationPreferences["sound"]
      : INITIAL_SETTINGS.notifications.sound,
    showPreview: rawNotifications?.showPreview === true,
  } satisfies NotificationPreferences;

  return {
    ...rest,
    notifications,
    interestedCommentsTimestampShortcutEnabled:
      input.interestedCommentsTimestampShortcutEnabled !== false,
    customSurfaceLight: (settings?.customSurfaceLight as string | null) ?? legacySurface ?? rest.customSurfaceLight,
    customSurfaceDark: (settings?.customSurfaceDark as string | null) ?? legacySurface ?? rest.customSurfaceDark,
    customBackgroundLight: (settings?.customBackgroundLight as string | null) ?? legacyBackground ?? rest.customBackgroundLight,
    customBackgroundDark: (settings?.customBackgroundDark as string | null) ?? legacyBackground ?? rest.customBackgroundDark,
  };
}

function normalizePresidingPrefs(prefs?: Partial<PresidingPrefs>): PresidingPrefs {
  const defaults = getDefaultPresidingPrefs();
  const rawCount = prefs?.chairmanExpectedCount;
  const chairmanExpectedCount = typeof rawCount === "number" && Number.isFinite(rawCount)
    ? Math.min(99, Math.max(1, Math.floor(rawCount)))
    : defaults.chairmanExpectedCount;
  const rawSeconds = prefs?.chairmanExpectedSeconds;
  const chairmanExpectedSeconds = typeof rawSeconds === "number" && Number.isFinite(rawSeconds)
    ? Math.min(59, Math.max(0, Math.floor(rawSeconds)))
    : defaults.chairmanExpectedSeconds;

  return {
    ...defaults,
    ...(prefs ?? {}),
    chairmanExpectedCount,
    chairmanExpectedSeconds,
  };
}

function migratePresidingConfig(raw: unknown, rollToCurrentWeek = true): PresidingConfig {
  const cfg = raw as Record<string, unknown> | null;
  const normalizeSections = (sections: unknown[], inheritedGroup: SectionGroup = null, initialOffset = 0): PresidingSection[] => {
    let cursor = initialOffset;
    return sections.map((value, index) => {
      const section = value as Partial<PresidingSection>;
      const group = section.group ?? inheritedGroup;
      const explicitOffset = typeof section.scheduledStartMinute === "number"
        ? Math.max(0, Math.floor(section.scheduledStartMinute))
        : cursor;
      const scheduledEndMinute = typeof section.scheduledEndMinute === "number"
        ? Math.max(explicitOffset, Math.floor(section.scheduledEndMinute))
        : explicitOffset + Math.max(0, section.duration ?? 0);
      const subsections = Array.isArray(section.subsections)
        ? normalizeSections(section.subsections, group, explicitOffset)
        : [];
      const normalized = {
        ...section,
        group: section.group ?? null,
        scheduledStartMinute: explicitOffset,
        scheduledEndMinute,
        updatedAt: typeof section.updatedAt === "string" ? section.updatedAt : "1970-01-01T00:00:00.000Z",
        timerRoles: getTimerRoles({
          id: section.id ?? "",
          titleEn: section.titleEn ?? "",
          titleEs: section.titleEs ?? "",
          group,
          timerRoles: section.timerRoles,
        }, inheritedGroup),
        subsections,
      } as PresidingSection;
      const end = subsections.length > 0
        ? subsections.reduce((max, child) => Math.max(max, (child.scheduledStartMinute ?? explicitOffset) + child.duration), explicitOffset)
        : explicitOffset + Math.max(0, normalized.duration ?? 0);
      cursor = Math.max(cursor, end) + (index === 0 ? 5 : 0);
      return normalized;
    });
  };

  const normalizeWeek = (value: unknown): ProgramWeek => {
    const week = value as Partial<ProgramWeek>;
    return {
      ...week,
      weekId: typeof week.weekId === "string" && week.weekId ? week.weekId : "default",
      weekRangeEn: week.weekRangeEn ?? "",
      weekRangeEs: week.weekRangeEs ?? "",
      bibleReading: week.bibleReading ?? "",
      updatedAt: typeof week.updatedAt === "string" ? week.updatedAt : "1970-01-01T00:00:00.000Z",
      sections: Array.isArray(week.sections) ? normalizeSections(week.sections) : [],
    } as ProgramWeek;
  };

  // Migrate old format: { sections, weekRangeEn, ... } → { weeks: [{ ... }], activeWeekId }
  if (cfg && Array.isArray(cfg.sections) && !Array.isArray(cfg.weeks)) {
    const defaultConfig = getDefaultPresidingConfig();
    return migratePresidingConfig({
      weeks: [{
        weekId: "default",
        weekRangeEn: (cfg.weekRangeEn as string) ?? defaultConfig.weeks[0].weekRangeEn,
        weekRangeEs: (cfg.weekRangeEs as string) ?? defaultConfig.weeks[0].weekRangeEs,
        bibleReading: (cfg.bibleReading as string) ?? defaultConfig.weeks[0].bibleReading,
         sections: normalizeSections(cfg.sections),
      }],
      activeWeekId: "default",
    });
  }

  if (!cfg || !Array.isArray(cfg.weeks)) return getDefaultPresidingConfig();
  const weeks = (cfg.weeks as unknown[]).map(normalizeWeek);
  if (!rollToCurrentWeek) {
    return { weeks, activeWeekId: typeof cfg.activeWeekId === "string" ? cfg.activeWeekId : weeks[0]?.weekId ?? null };
  }
  const currentWeekId = getProgramWeekId();
  const defaultWeek = weeks.find((week) => week.weekId === "default");
  const currentWeek = weeks.find((week) => week.weekId === currentWeekId);
  if (defaultWeek && !currentWeek) {
    defaultWeek.weekId = currentWeekId;
    const catalog = getJwWolWeekCatalogEntry(currentWeekId);
    if (catalog) Object.assign(defaultWeek, catalog);
  } else if (!currentWeek) {
    const template = getDefaultPresidingConfig().weeks[0];
    const catalog = getJwWolWeekCatalogEntry(currentWeekId);
    weeks.push({ ...template, ...(catalog ?? {}), weekId: currentWeekId, sections: normalizeSections(template.sections) });
  }
  return { weeks, activeWeekId: currentWeekId };
}

function migratePresidingSession(raw: unknown): MeetingSession | null {
  if (!raw || typeof raw !== "object") return null;
  const session = raw as Partial<MeetingSession>;
  if (!Array.isArray(session.log)) return null;

  return {
    id: session.id ?? uuid(),
    weekId: session.weekId ?? getProgramWeekId(),
    date: session.date ?? new Date().toISOString().slice(0, 10),
    startedAt: session.startedAt ?? new Date().toISOString(),
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : (session.startedAt ?? "1970-01-01T00:00:00.000Z"),
    log: session.log.map((entry) => {
      const log = entry as TimerLogEntry;
      return {
        ...log,
        id: log.id ?? uuid(),
        actualDurationSec: typeof log.actualDurationSec === "number"
          ? log.actualDurationSec
          : Math.max(0, (log.actualDurationMin ?? 0) * 60),
        updatedAt: typeof log.updatedAt === "string" ? log.updatedAt : (log.actualEndISO ?? "1970-01-01T00:00:00.000Z"),
      };
    }),
  };
}

function migratePresidingSessions(raw: unknown, current: MeetingSession | null): MeetingSession[] {
  const values = Array.isArray(raw) ? raw : [];
  const sessions = values
    .map((value) => migratePresidingSession(value))
    .filter((value): value is MeetingSession => Boolean(value));
  if (current && !sessions.some((session) => session.id === current.id)) sessions.push(current);
  return sessions;
}

function normalizeCommentBox(item: Partial<CommentsConfig["boxesByWeek"][string][number]>): CommentBox {
  return {
    id: item.id ?? newCommentId(),
    categoryId: item.categoryId ?? "",
    name: typeof item.name === "string" ? item.name : "",
    accumulatedSec: typeof item.accumulatedSec === "number" && Number.isFinite(item.accumulatedSec)
      ? Math.max(0, Math.round(item.accumulatedSec))
      : 0,
    runningSinceISO: typeof item.runningSinceISO === "string" ? item.runningSinceISO : undefined,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "1970-01-01T00:00:00.000Z",
  };
}

function migrateCommentsConfig(raw: unknown): CommentsConfig {
  const defaults = getDefaultCommentsConfig();
  if (!raw || typeof raw !== "object") return defaults;
  const cfg = raw as Partial<CommentsConfig> & { boxes?: unknown[] };
  const categories = Array.isArray(cfg.categories)
    ? cfg.categories.map((category, index) => {
        const item = category as Partial<CommentsConfig["categories"][number]>;
        return {
          id: item.id ?? newCommentId(),
          name: typeof item.name === "string" ? item.name : "",
          color: typeof item.color === "string" ? item.color : "#2B579A",
          icon: typeof item.icon === "string" ? item.icon : "category",
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "1970-01-01T00:00:00.000Z",
        };
      })
    : [];
  // New shape: per-week boxes keyed by program weekId.
  if (cfg.boxesByWeek && typeof cfg.boxesByWeek === "object") {
    const boxesByWeek: Record<string, CommentBox[]> = {};
    for (const [weekId, list] of Object.entries(cfg.boxesByWeek)) {
      boxesByWeek[weekId] = Array.isArray(list)
        ? list.map((box) => normalizeCommentBox(box as Partial<CommentBox>))
        : [];
    }
    return { categories, boxesByWeek };
  }
  // Legacy shape: { categories, boxes } → current program week bucket.
  if (Array.isArray(cfg.boxes)) {
    return {
      categories,
      boxesByWeek: {
        [getProgramWeekId()]: cfg.boxes.map((box) => normalizeCommentBox(box as Partial<CommentBox>)),
      },
    };
  }
  return { categories, boxesByWeek: {} };
}

function preserveLocalAssigneeNames(local: PresidingConfig, remote: PresidingConfig): PresidingConfig {
  const names = new Map<string, string>();
  local.weeks.forEach((week) => {
    const collect = (sections: PresidingSection[]) => sections.forEach((section) => {
      if (section.assigneeName) names.set(`${week.weekId}:${section.id}`, section.assigneeName);
      collect(section.subsections);
    });
    collect(week.sections);
  });
  const copy = (weekId: string, sections: PresidingSection[]): PresidingSection[] => sections.map((section) => ({
    ...section,
    assigneeName: names.get(`${weekId}:${section.id}`) ?? "",
    subsections: copy(weekId, section.subsections),
  }));
  return { ...remote, weeks: remote.weeks.map((week) => ({ ...week, sections: copy(week.weekId, week.sections) })) };
}

function tombstoneKey(type: ProgramTombstone["entityType"], key: string): string {
  return `${type}:${key}`;
}

function addProgramTombstone(
  tombstones: ProgramTombstone[],
  entityType: ProgramTombstone["entityType"],
  entityKey: string,
  timestamp = now(),
): ProgramTombstone[] {
  const next = tombstones.filter((item) => tombstoneKey(item.entityType, item.entityKey) !== tombstoneKey(entityType, entityKey));
  return [...next, { entityType, entityKey, deletedAt: timestamp, updatedAt: timestamp }];
}

function collectProgramTombstones(state: Pick<AppState, "presidingConfig" | "presidingSessions" | "presidingTombstones">): ProgramTombstone[] {
  const timestamp = now();
  let result = [...state.presidingTombstones];
  state.presidingConfig.weeks.forEach((week) => {
    result = addProgramTombstone(result, "week", week.weekId, timestamp);
    const collect = (sections: PresidingSection[]) => sections.forEach((section) => {
      result = addProgramTombstone(result, "intervention", `${week.weekId}:${section.id}`, timestamp);
      collect(section.subsections);
    });
    collect(week.sections);
  });
  state.presidingSessions.forEach((session) => {
    if (session.id) result = addProgramTombstone(result, "session", session.id, timestamp);
    session.log.forEach((entry) => {
      if (entry.id) result = addProgramTombstone(result, "log", entry.id, timestamp);
    });
  });
  return result;
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
      interestedStatuses: [...DEFAULT_INTERESTED_STATUSES],
      syncMetadata: INITIAL_SYNC_METADATA,
      uiState: INITIAL_UI_STATE,
presidingConfig: getDefaultPresidingConfig(),
      presidingPrefs: getDefaultPresidingPrefs(),
      presidingSession: null,
      presidingSessions: [],
      presidingTombstones: [],
      commentsConfig: getDefaultCommentsConfig(),

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
presidingConfig: getDefaultPresidingConfig(),
               presidingPrefs: getDefaultPresidingPrefs(),
                presidingSession: null,
                presidingSessions: [],
                presidingTombstones: [],
                commentsConfig: getDefaultCommentsConfig(),
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
presidingConfig: getDefaultPresidingConfig(),
           presidingPrefs: getDefaultPresidingPrefs(),
            presidingSession: null,
            presidingSessions: [],
            presidingTombstones: [],
            commentsConfig: getDefaultCommentsConfig(),
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

      toggleInterestedPersonCompleted: (id) =>
        set((s) => {
          const person = s.interestedPeople.find((p) => p.id === id);
          if (!person) return { interestedPeople: s.interestedPeople };
          const done = isInterestedPersonCompleted(person);
          const patch = done
            ? { completed: false, completedWeekKey: null }
            : { completed: true, completedWeekKey: isoWeekKey(new Date()) };
          return withPendingSync({
            interestedPeople: s.interestedPeople.map((p) =>
              p.id === id ? { ...p, ...patch, updated_at: now() } : p
            ),
          });
        }),

      deleteInterestedPerson: (id) =>
        set((s) =>
          withPendingSync({
            interestedPeople: s.interestedPeople.filter((person) => person.id !== id),
          })
        ),

      // ── Interested Status Config ─────────────────────────────────────
      addInterestedStatus: (name, color, icon) => {
        const id = `custom_${crypto.randomUUID()}`;
        set((s) =>
          withPendingSync({
            interestedStatuses: [
              ...s.interestedStatuses,
              {
                id,
                name,
                color,
                icon,
                sort_order: s.interestedStatuses.length,
              },
            ],
          })
        );
        return id;
      },

      deleteInterestedStatus: (id) => {
        const state = get();
        // Guard: prevent deleting the last status
        if (state.interestedStatuses.length <= 1) return null;

        const remaining = state.interestedStatuses
          .filter((s) => s.id !== id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const fallbackStatusId = remaining[0]?.id ?? "interested_person";
        const affectedCount = state.interestedPeople.filter((p) => p.status === id).length;

        set(
          withPendingSync({
            interestedStatuses: remaining.map((s, i) => ({ ...s, sort_order: i })),
            interestedPeople: state.interestedPeople.map((p) =>
              p.status === id ? { ...p, status: fallbackStatusId } : p
            ),
          })
        );
        return { reassignedTo: fallbackStatusId, affectedCount };
      },

      updateInterestedStatus: (id, patch) =>
        set((s) =>
          withPendingSync({
            interestedStatuses: s.interestedStatuses.map((status) =>
              status.id === id ? { ...status, ...patch } : status
            ),
          })
        ),

      reorderInterestedStatuses: (orderedIds) =>
        set((s) =>
          withPendingSync({
            interestedStatuses: s.interestedStatuses
              .map((status) => ({
                ...status,
                sort_order: orderedIds.indexOf(status.id),
              }))
              .sort((a, b) => a.sort_order - b.sort_order),
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
          const remoteProgram = (file as BackupFile & { program?: RemoteProgramPayload }).program;
          const remoteComments = (file as BackupFile & { comments?: RemoteCommentsPayload }).comments;
          // Guard: refuse to import if all data arrays are empty (non-remote source).
          // Prevents importing a blank/empty backup file from wiping existing data.
          if (options?.source !== "remote") {
            const hasTimeEntries = (file.time_entries ?? []).length > 0;
            const hasGoals = Array.isArray(file.goals) && file.goals.length > 0;
            const hasInterested = (file.interested_people ?? []).length > 0;
            if (!hasTimeEntries && !hasGoals && !hasInterested) {
              console.warn("[ServiceFlow] importData blocked: backup file has no data arrays");
              return {}; // No-op — preserve existing data
            }
          }

          const settings = normalizeSettings({ ...s.settings, ...(file.settings ?? {}) });
          const serviceTypes = ensureServiceTypesNotEmpty(
            sortServiceTypesByOrder(file.service_types),
            settings
          );
          const serviceTypeMap = new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));

          const nextProgramConfig = remoteProgram?.config
            ? migratePresidingConfig(remoteProgram.config)
            : s.presidingConfig;
           const nextSessions = remoteProgram?.sessions
             ? migratePresidingSessions(remoteProgram.sessions, null)
             : s.presidingSessions;
const nextTombstones = remoteProgram?.tombstones
             ? migrateProgramTombstones(remoteProgram.tombstones)
             : s.presidingTombstones;
          return {
            settings,
            profile: mergeImportedProfile(s.profile, file.profile),
            serviceTypes,
            timeEntries: (file.time_entries ?? []).map(normalizeTimeEntry),
            goals: normalizeGoals(file.goals, serviceTypeMap),
            interestedPeople: file.interested_people ?? [],
            interestedStatuses: file.interested_statuses?.length ? file.interested_statuses : get().interestedStatuses,
            presidingConfig: remoteProgram?.config ? preserveLocalAssigneeNames(s.presidingConfig, nextProgramConfig) : nextProgramConfig,
             presidingPrefs: remoteProgram?.prefs && typeof remoteProgram.prefs === "object"
               ? normalizePresidingPrefs({ ...s.presidingPrefs, ...(remoteProgram.prefs as Partial<PresidingPrefs>) })
               : normalizePresidingPrefs(s.presidingPrefs),
             presidingSession: nextSessions[nextSessions.length - 1] ?? null,
             presidingSessions: nextSessions,
             presidingTombstones: nextTombstones,
            commentsConfig: remoteComments?.config ? migrateCommentsConfig(remoteComments.config) : s.commentsConfig,
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

      // ── Presiding ────────────────────────────────────────────────────────
      setPresidingConfig: (cfg) => set((s) => {
        const normalized = migratePresidingConfig(cfg, false);
        const requestedWeekId = cfg.activeWeekId;
        const timestamp = now();
        const stampSections = (sections: PresidingSection[]): PresidingSection[] => sections.map((section) => ({
          ...section,
          updatedAt: timestamp,
          subsections: stampSections(section.subsections),
        }));
        const weeks = normalized.weeks.map((week) => ({
          ...week,
          updatedAt: timestamp,
          sections: stampSections(week.sections),
        }));
        const nextWeekIds = new Set(weeks.map((week) => week.weekId));
        let tombstones = [...s.presidingTombstones];
        s.presidingConfig.weeks.forEach((oldWeek) => {
          if (!nextWeekIds.has(oldWeek.weekId)) tombstones = addProgramTombstone(tombstones, "week", oldWeek.weekId, timestamp);
          const nextWeek = weeks.find((week) => week.weekId === oldWeek.weekId);
          const nextSectionIds = new Set<string>();
          const collectNext = (sections: PresidingSection[]) => sections.forEach((section) => { nextSectionIds.add(section.id); collectNext(section.subsections); });
          collectNext(nextWeek?.sections ?? []);
          const collectOld = (sections: PresidingSection[]) => sections.forEach((section) => {
            if (!nextSectionIds.has(section.id)) tombstones = addProgramTombstone(tombstones, "intervention", `${oldWeek.weekId}:${section.id}`, timestamp);
            collectOld(section.subsections);
          });
          collectOld(oldWeek.sections);
        });
        return withPendingSync({
          presidingConfig: requestedWeekId && weeks.some((week) => week.weekId === requestedWeekId)
            ? { ...normalized, weeks, activeWeekId: requestedWeekId }
            : { ...normalized, weeks },
          presidingTombstones: tombstones,
        });
      }),
      setPresidingPrefs: (patch) =>
        set((s) => withPendingSync({
          presidingPrefs: normalizePresidingPrefs({ ...s.presidingPrefs, ...patch, updatedAt: now() }),
        })),
      ensureActiveProgramWeek: (date = new Date()) =>
        set((s) => {
          const weekId = getProgramWeekId(date);
          const existing = s.presidingConfig.weeks.find((week) => week.weekId === weekId);
          if (s.presidingConfig.activeWeekId === weekId && existing) return {};
          const catalog = getJwWolWeekCatalogEntry(weekId);
          const template = getDefaultPresidingConfig().weeks[0];
          const weeks = existing
            ? s.presidingConfig.weeks
            : [...s.presidingConfig.weeks, { ...template, ...(catalog ?? {}), weekId }];
           return withPendingSync({ presidingConfig: { weeks, activeWeekId: weekId } });
        }),
      startPresidingSession: () =>
        set((s) => {
          const session: MeetingSession = {
            id: uuid(),
            weekId: s.presidingConfig.activeWeekId ?? getProgramWeekId(),
            date: new Date().toISOString().slice(0, 10),
             startedAt: new Date().toISOString(),
             log: [],
             updatedAt: now(),
          };
          return withPendingSync({ presidingSession: session, presidingSessions: [...s.presidingSessions, session] });
        }),
      addPresidingLogEntry: (entry) =>
        set((s) => {
          const current = s.presidingSession ?? {
            id: uuid(),
            weekId: s.presidingConfig.activeWeekId ?? getProgramWeekId(),
             date: new Date().toISOString().slice(0, 10),
             startedAt: new Date().toISOString(),
             log: [],
             updatedAt: now(),
           };
           const timestamp = now();
           const nextSession = {
             ...current,
             updatedAt: timestamp,
             log: [...current.log, {
               ...entry,
               id: entry.id ?? uuid(),
               actualDurationSec: entry.actualDurationSec ?? Math.max(0, entry.actualDurationMin * 60),
               updatedAt: timestamp,
             }],
          };
          const sessions = s.presidingSessions.some((session) => session.id === nextSession.id)
            ? s.presidingSessions.map((session) => session.id === nextSession.id ? nextSession : session)
            : [...s.presidingSessions, nextSession];
           return withPendingSync({
             presidingSession: nextSession,
             presidingSessions: sessions,
             presidingTombstones: s.presidingTombstones.filter((item) => !(item.entityType === "log" && item.entityKey === (entry.id ?? ""))),
           });
         }),
      updatePresidingLogEntry: (logId, patch) =>
        set((s) => {
          const timestamp = now();
          let found = false;
          const updateEntry = (entry: TimerLogEntry): TimerLogEntry => {
            if (entry.id !== logId) return entry;
            found = true;
            const next = { ...entry, ...patch };
            const startMs = Date.parse(next.actualStartISO);
            const endMs = Date.parse(next.actualEndISO);
             const hasExplicitDuration = typeof patch.actualDurationSec === "number" && Number.isFinite(patch.actualDurationSec);
             const durationSec = hasExplicitDuration
               ? Math.max(0, Math.round(patch.actualDurationSec as number))
               : Number.isFinite(startMs) && Number.isFinite(endMs)
                 ? Math.max(0, Math.round((endMs - startMs) / 1000))
                 : Math.max(0, next.actualDurationSec ?? next.actualDurationMin * 60);
            return {
              ...next,
              actualDurationSec: durationSec,
              actualDurationMin: Math.round(durationSec / 60),
              wasOvertime: durationSec > next.scheduledDurationMin * 60,
              updatedAt: timestamp,
            };
          };
          const nextSessions = s.presidingSessions.map((session) => {
            const nextLog = session.log.map(updateEntry);
            return nextLog.some((entry, index) => entry !== session.log[index])
              ? { ...session, log: nextLog, updatedAt: timestamp }
              : session;
          });
          if (!found) return {};
          const nextSession = s.presidingSession
            ? nextSessions.find((session) => session.id === s.presidingSession?.id) ?? s.presidingSession
            : null;
          return withPendingSync({ presidingSession: nextSession, presidingSessions: nextSessions });
        }),
      deletePresidingLogEntry: (logId) =>
        set((s) => {
          const timestamp = now();
          const removeFromLog = (log: TimerLogEntry[]) => log.filter((entry) => entry.id !== logId);
          const nextSession = s.presidingSession
            ? { ...s.presidingSession, log: removeFromLog(s.presidingSession.log) }
            : null;
          const nextSessions = s.presidingSessions.map((session) => ({
            ...session,
            log: removeFromLog(session.log),
          })).filter((session) => session.log.length > 0 || session.id === nextSession?.id);
           return withPendingSync({
             presidingSession: nextSession,
             presidingSessions: nextSessions,
             presidingTombstones: addProgramTombstone(s.presidingTombstones, "log", logId, timestamp),
           });
        }),
resetPresidingConfig: () =>
        set((s) => withPendingSync({
           presidingConfig: getDefaultPresidingConfig(),
           presidingPrefs: getDefaultPresidingPrefs(),
            presidingSession: null,
            presidingSessions: [],
            presidingTombstones: collectProgramTombstones(s),
         })),

      // ── Comments ────────────────────────────────────────────────────────
      setCommentsConfig: (cfg) =>
        set(withPendingSync({
          commentsConfig: migrateCommentsConfig(cfg),
        })),
      updateCommentBox: (weekId, boxId, patch) =>
        set((s) => withPendingSync({
          commentsConfig: {
            ...s.commentsConfig,
            boxesByWeek: {
              ...s.commentsConfig.boxesByWeek,
              [weekId]: (s.commentsConfig.boxesByWeek[weekId] ?? []).map((box) =>
                box.id === boxId ? { ...box, ...patch, updatedAt: now() } : box
              ),
            },
          },
        })),
      resetCommentsConfig: () =>
        set(withPendingSync({
          commentsConfig: getDefaultCommentsConfig(),
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
            interestedStatuses: [...DEFAULT_INTERESTED_STATUSES],
            uiState: INITIAL_UI_STATE,
presidingConfig: getDefaultPresidingConfig(),
             presidingPrefs: getDefaultPresidingPrefs(),
             presidingSession: null,
             presidingSessions: [],
             presidingTombstones: collectProgramTombstones(get()),
             commentsConfig: getDefaultCommentsConfig(),
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
        interestedStatuses: state.interestedStatuses,
        syncMetadata: state.syncMetadata,
presidingConfig: state.presidingConfig,
         presidingPrefs: state.presidingPrefs,
          presidingSession: state.presidingSession,
          presidingSessions: state.presidingSessions,
          presidingTombstones: state.presidingTombstones,
          commentsConfig: state.commentsConfig,
      }) as unknown as AppState,
      // CRITICAL: Prevent stale IndexedDB data from overwriting freshly-synced
      // Supabase data. If current state has real data (sync already imported),
      // prefer it over persisted data. Otherwise use persisted (normal hydration).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;

        const hasCurrentData =
          current.timeEntries.length > 0 ||
          current.interestedPeople.length > 0 ||
          current.goals.length > 0;

        const settings = normalizeSettings({
          ...current.settings,
          ...(hasCurrentData ? {} : (p.settings ?? {})),
        });

        const serviceTypes = ensureServiceTypesNotEmpty(
          sortServiceTypesByOrder(
            hasCurrentData ? current.serviceTypes : (p.serviceTypes ?? current.serviceTypes),
          ),
          settings,
        );
        const serviceTypeMap = new Map(serviceTypes.map((st) => [st.id, st]));

        return {
          ...current,
          ...(hasCurrentData ? {} : p),
          profile: normalizePersistedProfile(
            hasCurrentData && current.profile?.google_id ? current.profile : (p.profile ?? current.profile),
          ),
          settings,
          serviceTypes,
          timeEntries: (hasCurrentData ? current.timeEntries : (p.timeEntries ?? current.timeEntries)).map(normalizeTimeEntry),
          goals: normalizeGoals(hasCurrentData ? current.goals : (p.goals ?? current.goals), serviceTypeMap),
          interestedPeople: hasCurrentData ? current.interestedPeople : (p.interestedPeople ?? current.interestedPeople),
          interestedStatuses: hasCurrentData && current.interestedStatuses?.length
            ? current.interestedStatuses
            : (p.interestedStatuses?.length ? p.interestedStatuses : current.interestedStatuses),
          syncMetadata: hasCurrentData ? current.syncMetadata : (p.syncMetadata ?? current.syncMetadata),
          uiState: current.uiState,
presidingConfig: migratePresidingConfig(p.presidingConfig ?? current.presidingConfig),
             presidingPrefs: normalizePresidingPrefs(p.presidingPrefs ?? current.presidingPrefs),
             presidingSession: migratePresidingSession(p.presidingSession ?? current.presidingSession),
             presidingSessions: migratePresidingSessions(p.presidingSessions, migratePresidingSession(p.presidingSession ?? current.presidingSession)),
             presidingTombstones: migrateProgramTombstones(p.presidingTombstones ?? current.presidingTombstones),
             commentsConfig: migrateCommentsConfig(p.commentsConfig ?? current.commentsConfig),
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
  interestedStatuses?: InterestedStatusConfig[];
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
    interested_statuses: state.interestedStatuses ?? [],
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
  if (Object.prototype.hasOwnProperty.call(obj, "interested_people") && !Array.isArray(obj.interested_people)) {
    throw new Error("Invalid backup file: interested_people must be an array");
  }
  return obj as unknown as BackupFile;
}
