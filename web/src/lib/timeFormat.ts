/**
 * Shared time formatting so every view (card, fullscreen, pill, tab title)
 * renders identical strings from the same millisecond value.
 */

export type TimerPrecision = "s" | "cs" | "ms";

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** `HH:MM:SS` with an optional `.cc` / `.mmm` fraction. */
export function formatDuration(ms: number, precision: TimerPrecision = "s"): string {
  const value = Math.max(0, ms);
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  if (precision === "s") return base;
  const fraction = value % 1000;
  if (precision === "cs") return `${base}.${pad2(Math.floor(fraction / 10))}`;
  return `${base}.${String(Math.floor(fraction)).padStart(3, "0")}`;
}

/** Compact timer text for the tab title: `MM:SS`, or `H:MM:SS` past the hour. */
export function formatTitleTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(minutes)}:${pad2(seconds)}`;
}

interface ClockFormatOptions {
  timeZone?: string;
  hour12: boolean;
  locale: string;
  showSeconds?: boolean;
}

export function formatClock(now: Date, options: ClockFormatOptions): string {
  const { timeZone, hour12, locale, showSeconds = true } = options;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" } : {}),
      hour12,
      ...(timeZone ? { timeZone } : {}),
    }).format(now);
  } catch {
    return showSeconds ? "--:--:--" : "--:--";
  }
}

export function formatClockDate(now: Date, options: { timeZone?: string; locale: string }): string {
  try {
    return new Intl.DateTimeFormat(options.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    }).format(now);
  } catch {
    return "";
  }
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Mexico_City",
  "America/Santo_Domingo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Lima",
  "America/Caracas",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function getTimeZoneOptions(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.length > 0) return values;
    }
  } catch {
    // Fall through to the curated list.
  }
  return FALLBACK_TIMEZONES;
}

export function humanizeTimeZone(tz: string): string {
  const segment = tz.split("/").pop() ?? tz;
  return segment.replace(/_/g, " ");
}
