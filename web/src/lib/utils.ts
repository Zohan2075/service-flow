import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns a color for a monthly cap progress bar driven by the exact fraction
 * of the cap used. Smooth gradient from red (0) through amber (~0.5) to green
 * (full cap), with special cases: exempt hours alone filling the cap → blue,
 * total usage over the cap → amber.
 */
export function capProgressColor(capped: number, exempt: number, cap: number): string {
  if (exempt >= cap) return "hsl(217, 91%, 60%)";
  const total = capped + exempt;
  if (total > cap) return "hsl(38, 92%, 50%)";
  const f = Math.max(0, Math.min(1, total / cap));
  return `hsl(${Math.round(120 * f)}, 80%, 50%)`;
}
