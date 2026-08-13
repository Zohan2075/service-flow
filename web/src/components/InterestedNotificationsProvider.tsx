"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useStore } from "@/lib/store";
import {
  findDueInterestedNotifications,
  getNotificationSupport,
  hasSeenNotification,
  markNotificationSeen,
  notificationPermission,
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  subscribeToPush,
  unsubscribeFromPush,
  unlockNotificationAudio,
} from "@/lib/notifications";
import { deletePushSubscription, upsertPushSubscription } from "@/lib/supabase";

interface NotificationContextValue {
  supported: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  testNotification: () => Promise<boolean>;
  testSound: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useInterestedNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useInterestedNotifications must be used inside InterestedNotificationsProvider");
  return context;
}

export function InterestedNotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useSupabaseAuth();
  const settings = useStore((state) => state.settings);
  const people = useStore((state) => state.interestedPeople);
  const interestedStatuses = useStore((state) => state.interestedStatuses);
  const updateSettings = useStore((state) => state.updateSettings);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the first server/client render identical. Browser APIs are detected
  // only after hydration to avoid SSR markup mismatches.
  const [support, setSupport] = useState({
    supported: false,
    pushSupported: false,
    permission: "unsupported" as NotificationPermission | "unsupported",
  });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    const nextSupport = getNotificationSupport();
    setSupport(nextSupport);
    setPermission(nextSupport.permission);
  }, []);

  const checkForeground = useCallback(async () => {
    if (!session?.user?.id || !settings.notifications.enabled || notificationPermission() !== "granted") return;
    const due = findDueInterestedNotifications(people, settings.notifications, settings.language, interestedStatuses);
    for (const notification of due) {
      if (hasSeenNotification(session.user.id, notification.key)) continue;
      markNotificationSeen(session.user.id, notification.key);
      await showBrowserNotification(notification);
      await playNotificationSound(settings.notifications.sound);
    }
  }, [people, interestedStatuses, session?.user?.id, settings.language, settings.notifications]);

  const refreshSubscription = useCallback(async () => {
    if (!support.pushSupported || !session?.user?.id) return;
    const registration = await navigator.serviceWorker.ready;
    setSubscribed(Boolean(await registration.pushManager.getSubscription()));
  }, [session?.user?.id, support.pushSupported]);

  useEffect(() => {
    void refreshSubscription().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [refreshSubscription]);

  useEffect(() => {
    if (!session?.user?.id || !settings.notifications.enabled) return;
    void checkForeground();
    const timer = window.setInterval(() => void checkForeground(), settings.notifications.frequencyMinutes * 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void checkForeground(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkForeground, session?.user?.id, settings.notifications.enabled, settings.notifications.frequencyMinutes]);

  const enableNotifications = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unlockNotificationAudio();
      const permission = await requestNotificationPermission();
      setPermission(permission);
      if (permission !== "granted") {
        updateSettings({ notifications: { ...settings.notifications, enabled: false } });
        return false;
      }
      const subscription = await subscribeToPush();
      if (subscription && session?.user?.id) {
        await upsertPushSubscription(session.user.id, subscription);
        setSubscribed(true);
      }
      updateSettings({ notifications: { ...settings.notifications, enabled: true } });
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, [session?.user?.id, settings.notifications, updateSettings]);

  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      if (session?.user?.id) await deletePushSubscription(session.user.id);
      setSubscribed(false);
      updateSettings({ notifications: { ...settings.notifications, enabled: false } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, [session?.user?.id, settings.notifications, updateSettings]);

  const testNotification = useCallback(async () => {
    const enabled = notificationPermission() === "granted" || await enableNotifications();
    if (!enabled) return false;
    await showBrowserNotification({
      key: `test-${Date.now()}`,
      title: "ServiceFlow notifications",
      body: "Your Interested People reminders are ready.",
      url: "/interested",
      personId: "",
      visitDate: "",
      categoryId: "",
      categoryName: "ServiceFlow",
      categoryIcon: "🔔",
      language: settings.language,
    });
    await playNotificationSound(settings.notifications.sound);
    return true;
  }, [enableNotifications, settings.notifications.sound]);

  const testSound = useCallback(async () => {
    await unlockNotificationAudio();
    await playNotificationSound(settings.notifications.sound);
  }, [settings.notifications.sound]);

  const value = useMemo(() => ({
    supported: support.supported,
    pushSupported: support.pushSupported,
    permission,
    subscribed,
    busy,
    error,
    enableNotifications,
    disableNotifications,
    testNotification,
    testSound,
  }), [busy, disableNotifications, enableNotifications, error, permission, subscribed, support.pushSupported, support.supported, testNotification, testSound]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
