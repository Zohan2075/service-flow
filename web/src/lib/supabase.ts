"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  UserProfile,
  AppSettings,
  ServiceType,
  TimeEntry,
  GoalDefinition,
  InterestedPerson,
  InterestedStatusConfig,
} from "@/types/data";
import type {
  MeetingSession,
  PresidingConfig,
  PresidingPrefs,
  PresidingSection,
  ProgramWeek,
  TimerLogEntry,
  ProgramTombstone,
  ProgramTombstoneType,
} from "@/types/presiding";
import { getDefaultPresidingConfig, getDefaultPresidingPrefs, getTimerRoles } from "@/types/presiding";

// ─── Client Singleton ────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}

export async function upsertPushSubscription(userId: string, subscription: PushSubscriptionJSON): Promise<void> {
  const endpoint = subscription.endpoint;
  const keys = subscription.keys;
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("Push subscription is missing encryption keys");
  const { error } = await getSupabase().from("push_subscriptions").upsert({
    user_id: userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    expiration_time: subscription.expirationTime ?? null,
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });
  if (error) throw new Error(`push subscription: ${error.message}`);
}

export async function deletePushSubscription(userId: string): Promise<void> {
  const { error } = await getSupabase().from("push_subscriptions").delete().eq("user_id", userId);
  if (error) throw new Error(`push subscription removal: ${error.message}`);
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function pushProfile(
  profile: UserProfile,
  userId: string,
): Promise<void> {
  const client = getSupabase();
  await client.from("profiles").upsert({
    user_id: userId,
    display_name: profile.displayName ?? null,
    bio: profile.bio ?? null,
    custom_image: profile.customImage ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function pullProfile(userId: string): Promise<UserProfile | null> {
  const client = getSupabase();
  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  // Map snake_case DB columns to UserProfile type
  return {
    google_id: userId,
    name: "",
    email: "",
    displayName: data.display_name ?? null,
    bio: data.bio ?? null,
    customImage: data.custom_image ?? null,
  } as UserProfile;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function pushSettings(
  settings: AppSettings,
  userId: string,
): Promise<void> {
  const client = getSupabase();
  await client.from("settings").upsert({
    user_id: userId,
    data: settings as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  });
}

export async function pullSettings(
  userId: string,
): Promise<AppSettings | null> {
  const client = getSupabase();
  const { data } = await client
    .from("settings")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.data as AppSettings) ?? null;
}

// ─── Service Types ───────────────────────────────────────────────────────────

export async function pushServiceTypes(
  items: ServiceType[],
  userId: string,
): Promise<void> {
  const client = getSupabase();
  if (items.length === 0) {
    const { error } = await client.from("service_types").delete().eq("user_id", userId);
    if (error) throw new Error(`pushServiceTypes delete: ${error.message}`);
    return;
  }
  const rows = items.map((s) => ({
    id: s.id,
    user_id: userId,
    name: s.name,
    description: s.description,
    entry_type: s.entry_type,
    color: s.color,
    icon: s.icon,
    sort_order: s.sort_order,
    is_active: s.is_active,
    cap_exempt: s.cap_exempt ?? false,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
  // Upsert first — if this fails, nothing is deleted
  const { error: upsErr } = await client.from("service_types").upsert(rows, { onConflict: "id" });
  if (upsErr) throw new Error(`pushServiceTypes upsert: ${upsErr.message}`);
  // Safe cleanup: delete stale rows NOT in current set
  const currentIds = items.map((s) => s.id);
  const { data: existing } = await client.from("service_types").select("id").eq("user_id", userId);
  const staleIds = (existing ?? []).filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await client.from("service_types").delete().in("id", staleIds);
    if (delErr) console.warn("[ServiceFlow] pushServiceTypes stale cleanup failed:", delErr.message);
  }
}

export async function pullServiceTypes(
  userId: string,
): Promise<ServiceType[]> {
  const client = getSupabase();
  const { data } = await client
    .from("service_types")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order");
  return (data ?? []).map(
    (r): ServiceType => ({
      id: r.id,
      name: r.name,
      description: r.description,
      entry_type: r.entry_type,
      color: r.color,
      icon: r.icon,
      sort_order: r.sort_order,
      is_active: r.is_active,
      cap_exempt: r.cap_exempt ?? false,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  );
}

// ─── Time Entries ────────────────────────────────────────────────────────────

export async function pushTimeEntries(
  items: TimeEntry[],
  userId: string,
): Promise<void> {
  const client = getSupabase();
  if (items.length === 0) {
    const { error } = await client.from("time_entries").delete().eq("user_id", userId);
    if (error) throw new Error(`pushTimeEntries delete: ${error.message}`);
    return;
  }
  const rows = items.map((e) => ({
    id: e.id,
    user_id: userId,
    title: e.title,
    notes: e.notes,
    location: e.location,
    start_time: e.start_time,
    end_time: e.end_time ?? null,
    duration_seconds: e.duration_seconds ?? null,
    units_quantity: e.units_quantity ?? null,
    units_label: e.units_label ?? null,
    service_type_id: e.service_type_id,
    is_planned: e.is_planned,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
  const { error: upsErr } = await client.from("time_entries").upsert(rows, { onConflict: "id" });
  if (upsErr) throw new Error(`pushTimeEntries upsert: ${upsErr.message}`);
  const currentIds = items.map((e) => e.id);
  const { data: existing } = await client.from("time_entries").select("id").eq("user_id", userId);
  const staleIds = (existing ?? []).filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await client.from("time_entries").delete().in("id", staleIds);
    if (delErr) console.warn("[ServiceFlow] pushTimeEntries stale cleanup failed:", delErr.message);
  }
}

export async function pullTimeEntries(
  userId: string,
): Promise<TimeEntry[]> {
  const client = getSupabase();
  const { data } = await client
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: false });
  return (data ?? []).map(
    (r): TimeEntry => ({
      id: r.id,
      title: r.title,
      notes: r.notes,
      location: r.location,
      start_time: r.start_time,
      end_time: r.end_time ?? null,
      duration_seconds: r.duration_seconds ?? null,
      units_quantity: r.units_quantity ?? null,
      units_label: r.units_label ?? null,
      service_type_id: r.service_type_id,
      is_planned: r.is_planned,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  );
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export async function pushGoals(
  items: GoalDefinition[],
  userId: string,
): Promise<void> {
  const client = getSupabase();
  if (items.length === 0) {
    const { error } = await client.from("goals").delete().eq("user_id", userId);
    if (error) throw new Error(`pushGoals delete: ${error.message}`);
    return;
  }
  const rows = items.map((g) => ({
    id: g.id,
    user_id: userId,
    name: g.name,
    scope: g.scope,
    service_type_id: g.service_type_id ?? null,
    service_type_ids: g.service_type_ids,
    monthly_duration_seconds: g.monthly_duration_seconds ?? null,
    monthly_units_quantity: g.monthly_units_quantity ?? null,
    yearly_duration_seconds: g.yearly_duration_seconds ?? null,
    yearly_units_quantity: g.yearly_units_quantity ?? null,
    yearly_start_month: g.yearly_start_month,
    created_at: g.created_at,
    updated_at: g.updated_at,
  }));
  const { error: upsErr } = await client.from("goals").upsert(rows, { onConflict: "id" });
  if (upsErr) throw new Error(`pushGoals upsert: ${upsErr.message}`);
  const currentIds = items.map((g) => g.id);
  const { data: existing } = await client.from("goals").select("id").eq("user_id", userId);
  const staleIds = (existing ?? []).filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await client.from("goals").delete().in("id", staleIds);
    if (delErr) console.warn("[ServiceFlow] pushGoals stale cleanup failed:", delErr.message);
  }
}

export async function pullGoals(userId: string): Promise<GoalDefinition[]> {
  const client = getSupabase();
  const { data } = await client
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []).map(
    (r): GoalDefinition => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      service_type_id: r.service_type_id ?? null,
      service_type_ids: r.service_type_ids,
      monthly_duration_seconds: r.monthly_duration_seconds ?? null,
      monthly_units_quantity: r.monthly_units_quantity ?? null,
      yearly_duration_seconds: r.yearly_duration_seconds ?? null,
      yearly_units_quantity: r.yearly_units_quantity ?? null,
      yearly_start_month: r.yearly_start_month,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  );
}

// ─── Interested People ───────────────────────────────────────────────────────

export async function pushInterestedPeople(
  items: InterestedPerson[],
  userId: string,
): Promise<void> {
  const client = getSupabase();
  if (items.length === 0) {
    const { error } = await client.from("interested_people").delete().eq("user_id", userId);
    if (error) throw new Error(`pushInterestedPeople delete: ${error.message}`);
    return;
  }
  const rows = items.map((p) => ({
    id: p.id,
    user_id: userId,
    name: p.name,
    last_name: p.last_name,
    gender: p.gender,
    age: p.age ?? null,
    address: p.address ?? null,
    comments: p.comments ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    initial_conversation_date: p.initial_conversation_date ?? null,
    next_visit_date: p.next_visit_date ?? null,
    next_visit_weekly_day: p.next_visit_weekly_day ?? null,
    status: p.status,
    completed: p.completed ?? false,
    completed_week_key: p.completedWeekKey ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
  const { error: upsErr } = await client.from("interested_people").upsert(rows, { onConflict: "id" });
  if (upsErr) throw new Error(`pushInterestedPeople upsert: ${upsErr.message}`);
  const currentIds = items.map((p) => p.id);
  const { data: existing } = await client.from("interested_people").select("id").eq("user_id", userId);
  const staleIds = (existing ?? []).filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await client.from("interested_people").delete().in("id", staleIds);
    if (delErr) console.warn("[ServiceFlow] pushInterestedPeople stale cleanup failed:", delErr.message);
  }
}

export async function pullInterestedPeople(
  userId: string,
): Promise<InterestedPerson[]> {
  const client = getSupabase();
  const { data } = await client
    .from("interested_people")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  return (data ?? []).map(
    (r): InterestedPerson => ({
      id: r.id,
      name: r.name,
      last_name: r.last_name,
      gender: r.gender,
      age: r.age ?? null,
      address: r.address ?? null,
      comments: r.comments ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      initial_conversation_date: r.initial_conversation_date ?? null,
      next_visit_date: r.next_visit_date ?? null,
      next_visit_weekly_day: r.next_visit_weekly_day ?? null,
      status: r.status,
      completed: r.completed ?? false,
      completedWeekKey: r.completed_week_key ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
  );
}

// ─── Interested Statuses ─────────────────────────────────────────────────────

export async function pushInterestedStatuses(
  items: InterestedStatusConfig[],
  userId: string,
): Promise<void> {
  const client = getSupabase();
  if (items.length === 0) {
    const { error } = await client.from("interested_statuses").delete().eq("user_id", userId);
    if (error) throw new Error(`pushInterestedStatuses delete: ${error.message}`);
    return;
  }
  const rows = items.map((s) => ({
    id: s.id,
    user_id: userId,
    name: s.name,
    color: s.color,
    icon: s.icon,
    sort_order: s.sort_order,
    updated_at: new Date().toISOString(),
  }));
  const { error: upsErr } = await client.from("interested_statuses").upsert(rows, { onConflict: "id" });
  if (upsErr) throw new Error(`pushInterestedStatuses upsert: ${upsErr.message}`);
  const currentIds = items.map((s) => s.id);
  const { data: existing } = await client.from("interested_statuses").select("id").eq("user_id", userId);
  const staleIds = (existing ?? []).filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await client.from("interested_statuses").delete().in("id", staleIds);
    if (delErr) console.warn("[ServiceFlow] pushInterestedStatuses stale cleanup failed:", delErr.message);
  }
}

export async function pullInterestedStatuses(
  userId: string,
): Promise<InterestedStatusConfig[]> {
  const client = getSupabase();
  const { data } = await client
    .from("interested_statuses")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order");
  return (data ?? []).map(
    (r): InterestedStatusConfig => ({
      id: r.id,
      name: r.name,
      color: r.color,
      icon: r.icon,
      sort_order: r.sort_order,
    }),
  );
}

// ─── Program / Presiding ──────────────────────────────────────────────────────

export interface ProgramSyncState {
  config: PresidingConfig;
  prefs: PresidingPrefs;
  sessions: MeetingSession[];
  tombstones: ProgramTombstone[];
}

function flattenProgramSections(sections: PresidingSection[], userId: string, weekId: string, parentId: string | null = null) {
  const rows: Record<string, unknown>[] = [];
  sections.forEach((section, index) => {
    rows.push({
      user_id: userId, week_id: weekId, section_id: section.id, parent_section_id: parentId, sort_order: index,
      title_en: section.titleEn, title_es: section.titleEs, duration_min: section.duration, group_name: section.group,
       scheduled_start_minute: section.scheduledStartMinute ?? 0,
       scheduled_end_minute: section.scheduledEndMinute ?? ((section.scheduledStartMinute ?? 0) + section.duration),
       timer_roles: getTimerRoles(section), updated_at: section.updatedAt ?? new Date(0).toISOString(),
    });
    rows.push(...flattenProgramSections(section.subsections, userId, weekId, section.id));
  });
  return rows;
}

function sanitizeProgramSections(sections: PresidingSection[]): unknown[] {
  return sections.map(({ assigneeName: _assigneeName, subsections, ...section }) => ({
      ...section,
    subsections: sanitizeProgramSections(subsections),
  }));
}

function sectionsFromRows(rows: Record<string, unknown>[]): PresidingSection[] {
  const byParent = new Map<string | null, Record<string, unknown>[]>();
  rows.forEach((row) => {
    const parent = typeof row.parent_section_id === "string" ? row.parent_section_id : null;
    const list = byParent.get(parent) ?? [];
    list.push(row);
    byParent.set(parent, list);
  });
  const build = (parent: string | null): PresidingSection[] => (byParent.get(parent) ?? [])
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((row) => ({
      id: String(row.section_id), titleEn: String(row.title_en ?? ""), titleEs: String(row.title_es ?? ""),
       duration: Number(row.duration_min ?? 0), assigneeName: "",
       group: (row.group_name as PresidingSection["group"]) ?? null,
       scheduledStartMinute: Number(row.scheduled_start_minute ?? 0),
       scheduledEndMinute: Number(row.scheduled_end_minute ?? (Number(row.scheduled_start_minute ?? 0) + Number(row.duration_min ?? 0))),
       updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      timerRoles: Array.isArray(row.timer_roles) ? row.timer_roles as PresidingSection["timerRoles"] : undefined,
      subsections: build(String(row.section_id)),
    }));
  return build(null);
}

function sectionsFromLegacyJson(value: unknown): PresidingSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? crypto.randomUUID()), titleEn: String(item.titleEn ?? item.title_en ?? ""), titleEs: String(item.titleEs ?? item.title_es ?? ""),
      duration: Number(item.duration ?? item.duration_min ?? 0), assigneeName: "",
       group: (item.group as PresidingSection["group"]) ?? null, scheduledStartMinute: Number(item.scheduledStartMinute ?? item.scheduled_start_minute ?? 0),
       scheduledEndMinute: Number(item.scheduledEndMinute ?? item.scheduled_end_minute ?? (Number(item.scheduledStartMinute ?? item.scheduled_start_minute ?? 0) + Number(item.duration ?? item.duration_min ?? 0))),
       updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
      timerRoles: Array.isArray(item.timerRoles) ? item.timerRoles as PresidingSection["timerRoles"] : undefined,
      subsections: sectionsFromLegacyJson(item.subsections),
    };
  });
}

export async function pushProgram(program: ProgramSyncState, userId: string): Promise<void> {
  const client = getSupabase();
  const remote = await pullProgram(userId);
  const remoteSections = remote?.config.weeks.flatMap((week) => flattenProgramSections(week.sections, userId, week.weekId)) ?? [];
  const remoteUpdates = new Map<string, string>();
  remote?.config.weeks.forEach((week) => remoteUpdates.set(`week:${week.weekId}`, week.updatedAt ?? "1970-01-01T00:00:00.000Z"));
  remoteSections.forEach((row) => remoteUpdates.set(`intervention:${row.week_id}:${row.section_id}`, String(row.updated_at ?? "1970-01-01T00:00:00.000Z")));
  remote?.sessions.forEach((session) => {
    if (session.id) remoteUpdates.set(`session:${session.id}`, session.updatedAt ?? "1970-01-01T00:00:00.000Z");
    session.log.forEach((entry) => { if (entry.id) remoteUpdates.set(`log:${entry.id}`, entry.updatedAt ?? "1970-01-01T00:00:00.000Z"); });
  });
  const tombstoneMap = new Map<string, ProgramTombstone>();
  [...(remote?.tombstones ?? []), ...program.tombstones].forEach((item) => {
    const key = `${item.entityType}:${item.entityKey}`;
    const existing = tombstoneMap.get(key);
    if (!existing || new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) tombstoneMap.set(key, item);
  });
  const isRemoteNewer = (type: ProgramTombstoneType, key: string, updatedAt?: string) => {
    const remoteUpdated = remoteUpdates.get(`${type}:${key}`);
    return Boolean(remoteUpdated && new Date(remoteUpdated).getTime() > new Date(updatedAt ?? "1970-01-01T00:00:00.000Z").getTime());
  };
  const tombstoneByKey = tombstoneMap;
  const isCurrent = (type: ProgramTombstoneType, key: string, updatedAt?: string) => {
    const tombstone = tombstoneByKey.get(`${type}:${key}`);
    return !isRemoteNewer(type, key, updatedAt) && (!tombstone || (updatedAt ? new Date(updatedAt).getTime() > new Date(tombstone.deletedAt).getTime() : false));
  };
  const localPrefsUpdated = program.prefs.updatedAt ?? new Date(0).toISOString();
  if (!remote?.prefs.updatedAt || new Date(localPrefsUpdated).getTime() >= new Date(remote.prefs.updatedAt).getTime()) {
    const { error: prefsError } = await client.from("program_preferences").upsert({
      user_id: userId, active_week_id: program.config.activeWeekId, auto_advance: program.prefs.autoAdvance,
      meeting_start_hour: program.prefs.meetingStartHour, meeting_start_minute: program.prefs.meetingStartMinute,
      time_format: program.prefs.timeFormat, chairman_expected_count: program.prefs.chairmanExpectedCount,
      chairman_expected_seconds: program.prefs.chairmanExpectedSeconds, updated_at: localPrefsUpdated,
    }, { onConflict: "user_id" });
    if (prefsError) throw new Error(`pushProgram preferences: ${prefsError.message}`);
  }

  const weeks = program.config.weeks.map((week) => ({
    user_id: userId, week_id: week.weekId, week_range_en: week.weekRangeEn, week_range_es: week.weekRangeEs,
    bible_reading: week.bibleReading, sections_json: sanitizeProgramSections(week.sections), updated_at: week.updatedAt ?? new Date(0).toISOString(),
  })).filter((week) => isCurrent("week", week.week_id, week.updated_at));
  if (weeks.length > 0) {
    const { error } = await client.from("program_weeks").upsert(weeks, { onConflict: "user_id,week_id" });
    if (error) throw new Error(`pushProgram weeks: ${error.message}`);
  }
  const interventions = program.config.weeks
    .flatMap((week) => flattenProgramSections(week.sections, userId, week.weekId))
    .filter((row) => isCurrent("intervention", `${row.week_id}:${row.section_id}`, row.updated_at as string | undefined));
  if (interventions.length > 0) {
    const { error } = await client.from("program_interventions").upsert(interventions, { onConflict: "user_id,week_id,section_id" });
    if (error) throw new Error(`pushProgram interventions: ${error.message}`);
  }

  const sessions = program.sessions.map((session) => ({
    id: session.id ?? crypto.randomUUID(), user_id: userId, week_id: session.weekId ?? program.config.activeWeekId ?? "default",
    session_date: session.date, started_at: session.startedAt, log_json: session.log,
    updated_at: session.updatedAt ?? new Date(0).toISOString(),
  })).filter((session) => isCurrent("session", session.id, session.updated_at));
  if (sessions.length > 0) {
    const { error } = await client.from("program_sessions").upsert(sessions, { onConflict: "id" });
    if (error) throw new Error(`pushProgram sessions: ${error.message}`);
  }
  const sessionIds = new Map(sessions.map((session) => [session.session_date + session.week_id, session.id]));
  const logs = program.sessions.flatMap((session) => session.log.map((entry, logIndex) => {
    const weekId = session.weekId ?? program.config.activeWeekId ?? "default";
    const sessionId = sessionIds.get(session.date + weekId);
    return {
    id: entry.id ?? `${sessionId ?? session.date}-${logIndex}`, user_id: userId,
    week_id: weekId, session_id: sessionId,
    section_id: entry.sectionId, title_en: entry.titleEn, title_es: entry.titleEs, role: entry.role ?? null,
    scheduled_duration_min: entry.scheduledDurationMin, actual_start: entry.actualStartISO, actual_end: entry.actualEndISO,
    actual_duration_sec: entry.actualDurationSec ?? Math.max(0, entry.actualDurationMin * 60), was_overtime: entry.wasOvertime,
    updated_at: entry.updatedAt ?? new Date(0).toISOString(),
  }; })).filter((entry) => Boolean(entry.session_id) && isCurrent("log", entry.id, entry.updated_at));
  if (logs.length > 0) {
    const { error } = await client.from("program_timer_logs").upsert(logs, { onConflict: "user_id,week_id,session_id,section_id,role" });
    if (error) throw new Error(`pushProgram logs: ${error.message}`);
  }

  if (tombstoneMap.size > 0) {
    const { error } = await client.from("program_sync_tombstones").upsert([...tombstoneMap.values()].map((item) => ({
      user_id: userId, entity_type: item.entityType, entity_key: item.entityKey,
      deleted_at: item.deletedAt, updated_at: item.updatedAt,
    })), { onConflict: "user_id,entity_type,entity_key" });
    if (error) throw new Error(`pushProgram tombstones: ${error.message}`);
  }
}

export async function pullProgram(userId: string): Promise<ProgramSyncState | null> {
  const client = getSupabase();
  const [prefsResult, weeksResult, interventionsResult, sessionsResult, logsResult, tombstonesResult] = await Promise.all([
    client.from("program_preferences").select("*").eq("user_id", userId).maybeSingle(),
    client.from("program_weeks").select("*").eq("user_id", userId).order("week_id"),
    client.from("program_interventions").select("*").eq("user_id", userId).order("sort_order"),
    client.from("program_sessions").select("*").eq("user_id", userId).order("session_date", { ascending: false }),
    client.from("program_timer_logs").select("*").eq("user_id", userId).order("actual_start"),
    client.from("program_sync_tombstones").select("*").eq("user_id", userId).order("updated_at"),
  ]);
  const error = [prefsResult, weeksResult, interventionsResult, sessionsResult, logsResult, tombstonesResult].find((result) => result.error)?.error;
  if (error) throw new Error(`pullProgram: ${error.message}`);
  const tombstones: ProgramTombstone[] = (tombstonesResult.data ?? []).map((row) => ({
    entityType: row.entity_type as ProgramTombstoneType,
    entityKey: String(row.entity_key),
    deletedAt: String(row.deleted_at),
    updatedAt: String(row.updated_at ?? row.deleted_at),
  }));
  if (!prefsResult.data && (weeksResult.data ?? []).length === 0 && tombstones.length === 0) return null;

  const tombstoneMap = new Map(tombstones.map((item) => [`${item.entityType}:${item.entityKey}`, item]));
  const isVisible = (type: ProgramTombstoneType, key: string, updatedAt: unknown) => {
    const tombstone = tombstoneMap.get(`${type}:${key}`);
    return !tombstone || new Date(String(updatedAt ?? 0)).getTime() > new Date(tombstone.deletedAt).getTime();
  };

  const weekRows = ((weeksResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => isVisible("week", String(row.week_id), row.updated_at));
  const interventionRows = (interventionsResult.data ?? []) as Record<string, unknown>[];
  const weeks: ProgramWeek[] = weekRows.map((row) => {
    const visibleInterventions = interventionRows.filter((item) => item.week_id === row.week_id && isVisible("intervention", `${item.week_id}:${item.section_id}`, item.updated_at));
    return {
    weekId: String(row.week_id), weekRangeEn: String(row.week_range_en ?? ""), weekRangeEs: String(row.week_range_es ?? ""),
    bibleReading: String(row.bible_reading ?? ""), sections: visibleInterventions.length > 0 || interventionRows.some((item) => item.week_id === row.week_id)
      ? sectionsFromRows(visibleInterventions)
      : sectionsFromLegacyJson(row.sections_json),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
  });
  const prefs = prefsResult.data ? {
    autoAdvance: Boolean(prefsResult.data.auto_advance), meetingStartHour: Number(prefsResult.data.meeting_start_hour ?? 19),
    meetingStartMinute: Number(prefsResult.data.meeting_start_minute ?? 30), timeFormat: prefsResult.data.time_format === "12h" ? "12h" : "24h",
    chairmanExpectedCount: Number(prefsResult.data.chairman_expected_count ?? 1),
    chairmanExpectedSeconds: Number(prefsResult.data.chairman_expected_seconds ?? 0),
    updatedAt: typeof prefsResult.data.updated_at === "string" ? prefsResult.data.updated_at : undefined,
  } satisfies PresidingPrefs : getDefaultPresidingPrefs();
  const logsBySession = new Map<string, TimerLogEntry[]>();
  (logsResult.data ?? []).filter((row) => isVisible("log", String(row.id), row.updated_at)).forEach((row) => {
    const key = String(row.session_id); const list = logsBySession.get(key) ?? [];
    list.push({ id: String(row.id), sectionId: String(row.section_id), titleEn: String(row.title_en ?? ""), titleEs: String(row.title_es ?? ""),
      role: row.role === "assignee" || row.role === "presiding" ? row.role : undefined, scheduledDurationMin: Number(row.scheduled_duration_min ?? 0),
      actualStartISO: String(row.actual_start), actualEndISO: String(row.actual_end), actualDurationMin: Math.round(Number(row.actual_duration_sec ?? 0) / 60),
       actualDurationSec: Number(row.actual_duration_sec ?? 0), wasOvertime: Boolean(row.was_overtime),
       updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined });
    logsBySession.set(key, list);
  });
  const sessions: MeetingSession[] = ((sessionsResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => isVisible("session", String(row.id), row.updated_at))
    .map((row) => ({
    id: String(row.id), weekId: String(row.week_id), date: String(row.session_date), startedAt: String(row.started_at),
    log: logsBySession.get(String(row.id)) ?? (Array.isArray(row.log_json) ? row.log_json as TimerLogEntry[] : []),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }));
  const config = weeks.length > 0 ? { weeks, activeWeekId: prefsResult.data?.active_week_id ?? weeks[0].weekId } : getDefaultPresidingConfig();
  return { config, prefs, sessions, tombstones };
}

// ─── Bulk Push (full sync upload) ────────────────────────────────────────────

export interface SyncState {
  profile: UserProfile | null;
  settings: AppSettings;
  serviceTypes: ServiceType[];
  timeEntries: TimeEntry[];
  goals: GoalDefinition[];
  interestedPeople: InterestedPerson[];
  interestedStatuses: InterestedStatusConfig[];
  program: ProgramSyncState | null;
}

export async function pushAll(state: SyncState, userId: string): Promise<void> {
  const errors: string[] = [];

  // Phase 1: push service_types FIRST (required for FK references)
  try {
    await pushServiceTypes(state.serviceTypes, userId);
  } catch (err) {
    errors.push(`serviceTypes: ${err instanceof Error ? err.message : err}`);
  }

  // Phase 2: push everything else — each independently so one table's
  // failure doesn't block other tables from syncing.
  const tasks: Array<{ label: string; fn: () => Promise<void> }> = [];

  if (state.profile) {
    tasks.push({ label: "profile", fn: () => pushProfile(state.profile!, userId) });
  }
  tasks.push({ label: "settings", fn: () => pushSettings(state.settings, userId) });
  tasks.push({ label: "timeEntries", fn: () => pushTimeEntries(state.timeEntries, userId) });
  tasks.push({ label: "goals", fn: () => pushGoals(state.goals, userId) });
  tasks.push({ label: "interestedPeople", fn: () => pushInterestedPeople(state.interestedPeople, userId) });
  tasks.push({ label: "interestedStatuses", fn: () => pushInterestedStatuses(state.interestedStatuses, userId) });
  if (state.program) tasks.push({ label: "program", fn: () => pushProgram(state.program!, userId) });

  const results = await Promise.allSettled(tasks.map((t) => t.fn()));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`[ServiceFlow] pushAll ${tasks[i].label}: ${msg}`);
      errors.push(`${tasks[i].label}: ${msg}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Sync errors: ${errors.join("; ")}`);
  }
}

// ─── Bulk Pull (full sync download) ──────────────────────────────────────────

export async function pullAll(
  userId: string,
): Promise<SyncState> {
  const results = await Promise.allSettled([
    pullProfile(userId),
    pullSettings(userId),
    pullServiceTypes(userId),
    pullTimeEntries(userId),
    pullGoals(userId),
    pullInterestedPeople(userId),
    pullInterestedStatuses(userId),
    pullProgram(userId),
  ]);

  // Program schema failures must not be treated as an empty remote program.
  // This keeps missing tables/schema-cache issues visible to the sync caller.
  const programResult = results[7];
  if (programResult.status === "rejected") {
    throw programResult.reason instanceof Error
      ? programResult.reason
      : new Error(String(programResult.reason));
  }

  const get = <T>(index: number, fallback: T): T => {
    const r = results[index];
    return r.status === "fulfilled" ? (r.value as T) : fallback;
  };

  const profileRow = get<UserProfile | null>(0, null);
  const settings = get<AppSettings | null>(1, null);
  const serviceTypes = get<ServiceType[]>(2, []);
  const timeEntries = get<TimeEntry[]>(3, []);
  const goals = get<GoalDefinition[]>(4, []);
  const interestedPeople = get<InterestedPerson[]>(5, []);
  const interestedStatuses = get<InterestedStatusConfig[]>(6, []);
  const program = get<ProgramSyncState | null>(7, null);

  // Log per-table failures
  const labels = ["profile", "settings", "serviceTypes", "timeEntries", "goals", "interestedPeople", "interestedStatuses", "program"];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[ServiceFlow] pullAll ${labels[i]}:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });

  // Build profile from Supabase user + profiles table
  let profile: UserProfile | null = null;
  if (profileRow) {
    const client = getSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) {
      profile = {
        google_id: user.id,
        name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          "User",
        email: user.email ?? "",
        image: user.user_metadata?.avatar_url ?? null,
        displayName: profileRow.displayName ?? null,
        bio: profileRow.bio ?? null,
        customImage: profileRow.customImage ?? null,
      };
    }
  }

  return {
    profile,
    settings: settings ?? ({} as AppSettings),
    serviceTypes,
    timeEntries,
    goals,
    interestedPeople,
    interestedStatuses: interestedStatuses.length > 0 ? interestedStatuses : [],
    program,
  };
}
