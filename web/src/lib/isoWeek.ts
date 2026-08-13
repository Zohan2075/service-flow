import type { InterestedPerson } from "@/types/data";

/**
 * ISO 8601 week key for a date, e.g. "2026-W33".
 * Uses local calendar components, then computes the ISO week number in UTC.
 * The same algorithm is duplicated in the send-interested-notifications edge
 * function (Deno, no dependencies) — keep both in sync.
 */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * A weekly-recurring person counts as completed only when marked completed
 * during the current week (completedWeekKey === current week key). A
 * one-time person (no weekly day) counts as completed forever once
 * `completed` is true.
 */
export function isInterestedPersonCompleted(person: InterestedPerson, now = new Date()): boolean {
  if (!person.completed) return false;
  if (person.next_visit_weekly_day == null) return true;
  return person.completedWeekKey != null && person.completedWeekKey === isoWeekKey(now);
}
