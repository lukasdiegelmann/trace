/**
 * Client-side notifications, ported from NutriTrace's
 * src/lib/notifications.js: a browser notification and a push through the
 * user's service, and the goal and step-goal celebrations. Reminders at
 * fixed times are sent by the servers' schedulers; the old UI scheduled
 * local ones on Android only.
 */
import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";

export function canShowNotifications(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  if (!canShowNotifications()) return;
  try {
    const registration =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (registration) await registration.showNotification(title, { body });
    else new Notification(title, { body });
  } catch {
    // A browser that refuses is no reason to fail what was being done.
  }
}

/**
 * Sends through every enabled way, if `settingKey` is on: this device, and
 * the push service (through NutriTrace, which holds the saved address).
 */
export async function notify(
  settingKey: string,
  title: string,
  body: string,
  priority = 5,
): Promise<void> {
  await settingsStores.nt.ensureLoaded();
  const values = settingsStores.nt.getSnapshot().values as unknown as Record<
    string,
    unknown
  >;
  if (!values[settingKey]) return;
  if (values.notifLocalEnabled !== false) await showNotification(title, body);
  const service = values.notifPushService;
  if (typeof service === "string" && service !== "none") {
    try {
      await api.nt.post("/settings/push-test", {
        service,
        title,
        message: body,
        priority,
      });
    } catch {
      // The push service is down; the local notification stands.
    }
  }
}
