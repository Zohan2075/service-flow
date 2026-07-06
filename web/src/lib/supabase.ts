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

// ─── Bulk Push (full sync upload) ────────────────────────────────────────────

export interface SyncState {
  profile: UserProfile | null;
  settings: AppSettings;
  serviceTypes: ServiceType[];
  timeEntries: TimeEntry[];
  goals: GoalDefinition[];
  interestedPeople: InterestedPerson[];
  interestedStatuses: InterestedStatusConfig[];
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
  ]);

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

  // Log per-table failures
  const labels = ["profile", "settings", "serviceTypes", "timeEntries", "goals", "interestedPeople", "interestedStatuses"];
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
  };
}
