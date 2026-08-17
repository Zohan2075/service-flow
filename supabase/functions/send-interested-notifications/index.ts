import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Preferences = {
  enabled: boolean;
  leadTimeMinutes: number;
  frequencyMinutes: number;
  showPreview: boolean;
};

type Language = "en" | "es";

type Person = {
  id: string;
  name: string;
  last_name: string;
  next_visit_date: string | null;
  next_visit_weekly_day: number | null;
  completed: boolean;
  completed_week_key: string | null;
  status: string;
};

type StatusInfo = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function preferencesFrom(value: unknown): Preferences {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: raw.enabled === true,
    leadTimeMinutes: typeof raw.leadTimeMinutes === "number" && Number.isFinite(raw.leadTimeMinutes)
      ? Math.min(20160, Math.max(0, Math.floor(raw.leadTimeMinutes)))
      : typeof raw.advanceDays === "number" && Number.isFinite(raw.advanceDays)
        ? Math.min(7 * 24 * 60, Math.max(0, Math.floor(raw.advanceDays * 24 * 60)))
        : 24 * 60,
    frequencyMinutes: typeof raw.frequencyMinutes === "number" && Number.isFinite(raw.frequencyMinutes)
      ? Math.min(1440, Math.max(5, Math.floor(raw.frequencyMinutes)))
      : 30,
    showPreview: raw.showPreview === true,
  };
}

function utcDateKey(date: Date): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value: string | null): Date | null {
  if (!value) return null;
  const base = parseDate(value);
  if (!base) return null;
  const timeMatch = value.match(/T(\d{1,2}):(\d{2})/);
  if (timeMatch) base.setUTCHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  else base.setUTCHours(0, 0, 0, 0);
  return base;
}

function nextWeeklyDate(day: number | null, today: Date): Date | null {
  if (!Number.isInteger(day) || day == null || day < 0 || day > 6) return null;
  const result = new Date(today);
  result.setUTCDate(result.getUTCDate() + ((day - result.getUTCDay() + 7) % 7));
  return result;
}

// ISO 8601 week key ("YYYY-Www") computed in UTC. Keep in sync with
// web/src/lib/isoWeek.ts (client uses local date; this uses the UTC `today`).
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// A weekly-recurring person counts as completed only when completed during the
// current week; a one-time person counts as completed forever.
function isCompletedForWeek(person: Person, today: Date): boolean {
  if (!person.completed) return false;
  if (person.next_visit_weekly_day == null) return true;
  return person.completed_week_key != null && person.completed_week_key === isoWeekKey(today);
}

const CATEGORY_ICONS: Record<string, string> = {
  bible_student: "📖",
  return_visit: "🔄",
  interested_person: "👤",
  shepherding: "🐑",
};

function categoryIconFor(status: string): string {
  return CATEGORY_ICONS[status] ?? "🔔";
}

// Full next-visit datetime in UTC: weekly occurrences use the person's
// next_visit_date time-of-day when present, else UTC midnight. A weekly
// occurrence whose time already passed rolls to the following week.
function visitDateTimeFor(person: Person, now: Date): Date | null {
  if (isCompletedForWeek(person, now)) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const candidates: Date[] = [];

  const specific = parseDateTime(person.next_visit_date);
  if (specific && specific.getTime() >= today.getTime()) candidates.push(specific);

  if (person.next_visit_weekly_day != null) {
    const occurrence = nextWeeklyDate(person.next_visit_weekly_day, today);
    if (occurrence) {
      const timeOfDay = specific ? { hours: specific.getUTCHours(), minutes: specific.getUTCMinutes() } : null;
      occurrence.setUTCHours(timeOfDay?.hours ?? 0, timeOfDay?.minutes ?? 0, 0, 0);
      if (occurrence.getTime() < now.getTime()) occurrence.setUTCDate(occurrence.getUTCDate() + 7);
      candidates.push(occurrence);
    }
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

async function processUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  preferences: Preferences,
  language: Language,
  now: Date,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
) {
  if (!preferences.enabled) return { checked: false, sent: 0 };

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subscriptions?.length) return { checked: false, sent: 0 };

  const { data: run } = await admin
    .from("notification_runs")
    .select("last_checked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (run?.last_checked_at && now.getTime() - new Date(run.last_checked_at).getTime() < preferences.frequencyMinutes * 60_000) {
    return { checked: false, sent: 0 };
  }

  const { data: statusRows, error: statusError } = await admin
    .from("interested_statuses")
    .select("id, name, color, icon")
    .eq("user_id", userId);
  if (statusError) throw statusError;
  const statusMap = new Map<string, StatusInfo>((statusRows ?? []).map((s) => [s.id, s]));

  const { data: people, error: peopleError } = await admin
    .from("interested_people")
    .select("id, name, last_name, next_visit_date, next_visit_weekly_day, completed, completed_week_key, status")
    .eq("user_id", userId);
  if (peopleError) throw peopleError;

  const leadMs = preferences.leadTimeMinutes * 60_000;
  let sent = 0;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  for (const person of (people ?? []) as Person[]) {
    const visitDate = visitDateTimeFor(person, now);
    // Fire when the next visit is within the lead window and not yet past.
    if (!visitDate || now.getTime() < visitDate.getTime() - leadMs || now.getTime() > visitDate.getTime()) continue;
    const visitKey = utcDateKey(visitDate);
    const notificationKey = `interested:${person.id}:${visitKey}`;
    const { data: delivery, error: deliveryError } = await admin
      .from("notification_delivery")
      .upsert({
        user_id: userId,
        person_id: person.id,
        notification_key: notificationKey,
        channel: "push",
        status: "pending",
        scheduled_for: visitKey,
      }, { onConflict: "user_id,notification_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    if (!delivery) continue;

    const fullName = [person.name, person.last_name].filter(Boolean).join(" ") || "Interested person";
    const categoryName = statusMap.get(person.status)?.name ?? person.status;
    const isSpanish = language === "es";
    const payload = {
      title: isSpanish ? `Visita próxima: ${fullName}` : `Upcoming visit: ${fullName}`,
      body: preferences.showPreview
        ? isSpanish
          ? `${fullName} tiene una visita programada para el ${visitKey}.`
          : `${fullName} has a visit scheduled for ${visitKey}.`
        : isSpanish
          ? "Tienes una visita próxima de Personas Interesadas."
          : "You have an upcoming Interested People visit.",
      tag: notificationKey,
      icon: "/android-chrome-192x192.png",
      badge: "/icons/badge-96.png",
      data: {
        url: `/interested?personId=${encodeURIComponent(person.id)}`,
        personId: person.id,
        visitDate: visitKey,
        notificationKey,
        categoryId: person.status,
        categoryName,
        categoryIcon: categoryIconFor(person.status),
        language,
      },
    };

    let delivered = false;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
        delivered = true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id).eq("user_id", userId);
        } else {
          console.error("Push delivery failed", { userId, subscriptionId: subscription.id, error });
        }
      }
    }

    if (delivered) {
      await admin.from("notification_delivery").update({ status: "sent", delivered_at: now.toISOString() }).eq("id", delivery.id).eq("user_id", userId);
      sent += 1;
    } else {
      await admin.from("notification_delivery").delete().eq("id", delivery.id).eq("user_id", userId);
    }
  }

  await admin.from("notification_runs").upsert({ user_id: userId, last_checked_at: now.toISOString() });
  return { checked: true, sent };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) return json({ error: "Function secrets are incomplete" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: settingsRows, error: settingsError } = await admin.from("settings").select("user_id, data");
  if (settingsError) return json({ error: settingsError.message }, 500);

  const now = new Date();
  const results = [];
  for (const row of settingsRows ?? []) {
    try {
      results.push({ userId: row.user_id, ...(await processUser(admin, row.user_id, preferencesFrom(row.data?.notifications), row.data?.language === "es" ? "es" : "en", now, vapidPublicKey, vapidPrivateKey, vapidSubject)) });
    } catch (error) {
      console.error("Notification user processing failed", { userId: row.user_id, error });
      results.push({ userId: row.user_id, checked: false, sent: 0, error: "processing failed" });
    }
  }

  return json({ ok: true, results });
});
