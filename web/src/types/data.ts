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
}

export type WeekStart = "sunday" | "monday";

export interface AppSettings {
  theme: "light" | "dark" | "system";
  // Custom appearance (layered on top of the theme preset)
  accentColor: string;              // hex, e.g. "#2094f3"
  customSurface: string | null;     // hex or null = theme default
  customBackground: string | null;  // hex or null = theme default
  // Calendar layout
  weekStartsOn: WeekStart;
  // Entry creation defaults
  defaultEntryMode: "range" | "duration";
  defaultDurationHours: number;
  defaultDurationMinutes: number;
  // Sync
  autoSync: boolean;
  lastSyncedAt: string | null;      // ISO 8601
}

export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
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
  service_type_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarDay {
  date: string;           // "yyyy-MM-dd"
  entries: TimeEntry[];
  total_duration_seconds: number;
  total_duration_display: string;
}

// ─── Backup file schema ──────────────────────────────────────────────────────

export interface BackupFile {
  version: 1;
  exported_at: string;    // ISO 8601
  profile: UserProfile | null;
  settings: AppSettings;
  service_types: ServiceType[];
  time_entries: TimeEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

export function buildCalendarDays(
  entries: TimeEntry[],
  year: number,
  month: number
): CalendarDay[] {
  const byDate: Record<string, TimeEntry[]> = {};
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  for (const e of entries) {
    const d = e.start_time.slice(0, 10); // "yyyy-MM-dd"
    if (!d.startsWith(prefix)) continue;
    (byDate[d] ??= []).push(e);
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => {
      const totalSec = dayEntries.reduce(
        (sum, e) => sum + computeDurationSeconds(e),
        0
      );
      return {
        date,
        entries: dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        total_duration_seconds: totalSec,
        total_duration_display: durationDisplay(totalSec),
      };
    });
}
