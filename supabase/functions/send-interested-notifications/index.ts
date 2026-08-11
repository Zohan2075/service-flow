import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Preferences = {
  enabled: boolean;
  advanceDays: number;
  frequencyMinutes: number;
  showPreview: boolean;
};

type Person = {
  id: string;
  name: string;
  last_name: string;
  next_visit_date: string | null;
  next_visit_weekly_day: number | null;
  completed: boolean;
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
    advanceDays: typeof raw.advanceDays === "number" && Number.isFinite(raw.advanceDays)
      ? Math.min(30, Math.max(0, Math.floor(raw.advanceDays)))
      : 1,
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

function nextWeeklyDate(day: number | null, today: Date): Date | null {
  if (!Number.isInteger(day) || day == null || day < 0 || day > 6) return null;
  const result = new Date(today);
  result.setUTCDate(result.getUTCDate() + ((day - result.getUTCDay() + 7) % 7));
  return result;
}

function visitDateFor(person: Person, today: Date): Date | null {
  if (person.completed) return null;
  const candidates = [
    parseDate(person.next_visit_date),
    nextWeeklyDate(person.next_visit_weekly_day, today),
  ].filter((date): date is Date => Boolean(date && date >= today));
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

async function processUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  preferences: Preferences,
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

  const { data: people, error: peopleError } = await admin
    .from("interested_people")
    .select("id, name, last_name, next_visit_date, next_visit_weekly_day, completed")
    .eq("user_id", userId)
    .eq("completed", false);
  if (peopleError) throw peopleError;

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const latest = new Date(today);
  latest.setUTCDate(latest.getUTCDate() + preferences.advanceDays);
  let sent = 0;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  for (const person of (people ?? []) as Person[]) {
    const visitDate = visitDateFor(person, today);
    if (!visitDate || visitDate > latest) continue;
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
    const payload = {
      title: `Upcoming visit: ${fullName}`,
      body: preferences.showPreview ? `${fullName} has a visit scheduled for ${visitKey}.` : "You have an upcoming Interested People visit.",
      tag: notificationKey,
      data: { url: `/interested?personId=${encodeURIComponent(person.id)}`, personId: person.id, visitDate: visitKey, notificationKey },
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
      results.push({ userId: row.user_id, ...(await processUser(admin, row.user_id, preferencesFrom(row.data?.notifications), now, vapidPublicKey, vapidPrivateKey, vapidSubject)) });
    } catch (error) {
      console.error("Notification user processing failed", { userId: row.user_id, error });
      results.push({ userId: row.user_id, checked: false, sent: 0, error: "processing failed" });
    }
  }

  return json({ ok: true, results });
});
