import type { InterestedPerson, NotificationPreferences, NotificationSound } from "@/types/data";

export interface InterestedNotification {
  key: string;
  title: string;
  body: string;
  url: string;
  personId: string;
  visitDate: string;
}

export interface NotificationSupport {
  supported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | "unsupported";
}

const SOUND_CONFIG: Record<Exclude<NotificationSound, "off">, { frequency: number; duration: number }> = {
  soft: { frequency: 520, duration: 0.12 },
  chime: { frequency: 740, duration: 0.18 },
  alert: { frequency: 880, duration: 0.28 },
};

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { supported: false, pushSupported: false, permission: "unsupported" };
  }
  return {
    supported: true,
    pushSupported: "serviceWorker" in navigator && "PushManager" in window,
    permission: Notification.permission,
  };
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

function decodeBase64(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = window.atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64(vapidKey),
  });
  return subscription.toJSON();
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

function localDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : localDate(date);
}

function nextWeeklyDate(day: number, from: Date): Date | null {
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  const result = localDate(from);
  result.setDate(result.getDate() + ((day - result.getDay() + 7) % 7));
  return result;
}

export function getNextVisitDate(person: InterestedPerson, now = new Date()): Date | null {
  if (person.completed) return null;
  const today = localDate(now);
  const specific = parseDate(person.next_visit_date);
  const weekly = person.next_visit_weekly_day == null ? null : nextWeeklyDate(person.next_visit_weekly_day, today);
  const candidates = [specific, weekly].filter((date): date is Date => Boolean(date && date >= today));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

export function findDueInterestedNotifications(
  people: InterestedPerson[],
  preferences: NotificationPreferences,
  now = new Date(),
): InterestedNotification[] {
  if (!preferences.enabled) return [];
  const today = localDate(now);
  const latest = new Date(today);
  latest.setDate(latest.getDate() + preferences.advanceDays);

  return people.flatMap((person) => {
    const visitDate = getNextVisitDate(person, now);
    if (!visitDate || visitDate > latest) return [];
    const visitDateKey = dateKey(visitDate);
    const fullName = [person.name, person.last_name].filter(Boolean).join(" ") || "Interested person";
    const body = preferences.showPreview
      ? `${fullName} has a visit scheduled for ${visitDateKey}.`
      : "You have an upcoming Interested People visit.";
    return [{
      key: `${person.id}:${visitDateKey}`,
      title: `Upcoming visit: ${fullName}`,
      body,
      url: `/interested?personId=${encodeURIComponent(person.id)}`,
      personId: person.id,
      visitDate: visitDateKey,
    }];
  });
}

function dedupStorageKey(userId: string, key: string) {
  return `serviceflow-notification:${userId}:${key}`;
}

export function hasSeenNotification(userId: string, key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(dedupStorageKey(userId, key)) === "1";
}

export function markNotificationSeen(userId: string, key: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(dedupStorageKey(userId, key), "1");
}

export async function unlockNotificationAudio(): Promise<void> {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  audioContext ??= new AudioContext();
  await audioContext.resume();
  audioUnlocked = audioContext.state === "running";
}

export async function playNotificationSound(sound: NotificationSound): Promise<void> {
  if (sound === "off" || !audioUnlocked || !audioContext) return;
  const config = SOUND_CONFIG[sound];
  if (!config) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime;
  oscillator.type = sound === "alert" ? "square" : "sine";
  oscillator.frequency.setValueAtTime(config.frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(sound === "alert" ? 0.08 : 0.045, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + config.duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + config.duration + 0.02);
}

export async function showBrowserNotification(notification: InterestedNotification): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body: notification.body,
    tag: `serviceflow-${notification.key}`,
    data: { url: notification.url, personId: notification.personId, notificationKey: notification.key },
  };
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(notification.title, options);
  } else {
    new Notification(notification.title, options);
  }
}
