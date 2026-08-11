import { MeetingConfig, AppPreferences } from "@/types";
import { getDefaultConfig } from "./meeting";

const CONFIG_KEY = "meeting-config-v2";
const PREFS_KEY = "app-preferences";

const DEFAULT_PREFS: AppPreferences = {
  language: "en",
  theme: "light",
  autoAdvance: false,
  meetingStartHour: 19,
  meetingStartMinute: 30,
  timeFormat: "24h",
};

function isOldFormat(config: MeetingConfig): boolean {
  return !config.sections.some(s => s.group && s.subsections.length > 0);
}

export function loadConfig(): MeetingConfig {
  if (typeof window === "undefined") return getDefaultConfig();
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return getDefaultConfig();
  try {
    const parsed = JSON.parse(raw) as MeetingConfig;
    if (isOldFormat(parsed)) return getDefaultConfig();
    return parsed;
  } catch { return getDefaultConfig(); }
}

export function saveConfig(config: MeetingConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try { return { ...DEFAULT_PREFS, ...JSON.parse(raw) }; } catch { return DEFAULT_PREFS; }
}

export function savePreferences(prefs: AppPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}