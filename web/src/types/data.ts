// ─── Domain Types ────────────────────────────────────────────────────────────
// Single-user data model: one JSON file holds everything.

export interface UserProfile {
  google_id: string;
  name: string;
  email: string;
  image: string | null;
  // Personalization (editable, synced via Drive)
  displayName?: string | null;
  bio?: string | null;
  customImage?: string | null;
}

export type WeekStart = "sunday" | "monday";

export type Language = "en" | "es";

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: Language;
  // Custom appearance (layered on top of the theme preset)
  accentColor: string;              // hex, e.g. "#2094f3"
  customSurfaceLight: string | null;    // hex or null = light theme default
  customSurfaceDark: string | null;     // hex or null = dark theme default
  customBackgroundLight: string | null; // hex or null = light theme default
  customBackgroundDark: string | null;  // hex or null = dark theme default
  customSurface?: string | null;        // legacy import compatibility
  customBackground?: string | null;     // legacy import compatibility
  // Calendar layout
  weekStartsOn: WeekStart;
  // Entry creation defaults
  defaultEntryMode: "range" | "duration";
  defaultDurationHours: number;
  defaultDurationMinutes: number;
  planModeEnabled: boolean;
  // Reports
  showYearTotals: boolean;
  // Auto-sync to Drive (opt-out)
  autoSync: boolean;
  // Sync metadata (kept for manual backup)
  lastSyncedAt: string | null;      // ISO 8601
}

export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  entry_type: "time" | "units";
  color: string;          // hex, e.g. "#2094f3"
  icon: string;           // Material Symbols name, e.g. "build"
  sort_order: number;
  is_active: boolean;
  created_at: string;     // ISO 8601
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  start_time: string;     // ISO 8601
  end_time: string | null; // ISO 8601
  duration_seconds: number | null;
  units_quantity: number | null;
  units_label: string | null;
  service_type_id: string;
  is_planned: boolean;
  created_at: string;
  updated_at: string;
}

export type GoalScope = "service" | "combined";

export interface GoalDefinition {
  id: string;
  name: string;
  scope: GoalScope;
  service_type_id: string | null;
  service_type_ids: string[];
  monthly_duration_seconds: number | null;
  monthly_units_quantity: number | null;
  yearly_duration_seconds: number | null;
  yearly_units_quantity: number | null;
  yearly_start_month: number;
  created_at: string;
  updated_at: string;
}

export type InterestedPersonStatus = "bible_student" | "return_visit" | "interested_person";

export interface InterestedPerson {
  id: string;
  name: string;
  last_name: string;
  gender: "male" | "female";
  age: number | null;
  address: string | null;
  comments: string | null;
  latitude: number | null;
  longitude: number | null;
  initial_conversation_date: string | null;  // ISO 8601 date — when the initial conversation happened
  next_visit_date: string | null;  // ISO 8601 date
  status: InterestedPersonStatus;
  created_at: string;
  updated_at: string;
}

export interface CalendarDay {
  date: string;           // "yyyy-MM-dd"
  entries: TimeEntry[];
  total_duration_seconds: number;
  total_duration_display: string;
  total_units: number;
  planned_duration_seconds: number;
  planned_duration_display: string;
  planned_units: number;
}

// ─── Backup file schema ──────────────────────────────────────────────────────

export interface BackupFile {
  version: 1;
  exported_at: string;    // ISO 8601
  profile: UserProfile | null;
  settings: AppSettings;
  service_types: ServiceType[];
  time_entries: TimeEntry[];
  goals?: GoalDefinition[];
  interested_people?: InterestedPerson[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isUnitsEntry(entry: TimeEntry): boolean {
  return entry.units_quantity != null && entry.units_quantity > 0;
}

export function isPlannedEntry(entry: TimeEntry): boolean {
  return entry.is_planned;
}

export function computeDurationSeconds(entry: TimeEntry): number {
  if (entry.duration_seconds != null) return entry.duration_seconds;
  if (entry.start_time && entry.end_time) {
    return Math.max(
      0,
      Math.round(
        (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 1000
      )
    );
  }
  return 0;
}

export function durationDisplay(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

export function calendarDateKey(iso: string): string {
  const date = new Date(iso);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildCalendarDays(
  entries: TimeEntry[],
  year: number,
  month: number
): CalendarDay[] {
  const byDate: Record<string, TimeEntry[]> = {};
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  for (const e of entries) {
    const d = calendarDateKey(e.start_time);
    if (!d.startsWith(prefix)) continue;
    (byDate[d] ??= []).push(e);
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => {
      const sorted = dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time));
      const totalSec = sorted
        .filter((e) => !isUnitsEntry(e) && !isPlannedEntry(e))
        .reduce((sum, e) => sum + computeDurationSeconds(e), 0);
      const plannedSec = sorted
        .filter((e) => !isUnitsEntry(e) && isPlannedEntry(e))
        .reduce((sum, e) => sum + computeDurationSeconds(e), 0);
      const totalUnits = sorted
        .filter((e) => isUnitsEntry(e) && !isPlannedEntry(e))
        .reduce((sum, e) => sum + (e.units_quantity ?? 0), 0);
      const plannedUnits = sorted
        .filter((e) => isUnitsEntry(e) && isPlannedEntry(e))
        .reduce((sum, e) => sum + (e.units_quantity ?? 0), 0);
      return {
        date,
        entries: sorted,
        total_duration_seconds: totalSec,
        total_duration_display: durationDisplay(totalSec),
        total_units: totalUnits,
        planned_duration_seconds: plannedSec,
        planned_duration_display: durationDisplay(plannedSec),
        planned_units: plannedUnits,
      };
    });
}
