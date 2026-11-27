/**
 * A device notification and, when a push service is set up, the same message
 * through it. Ported from nutritrace/src/lib/notifications.js (`notify`); the
 * browser sends pushes through the backend, which holds the service's URL.
 */

export interface NotifyPrefs {
  /** Setting `notifLocalEnabled` */
  hasLocal: boolean;
  /** Setting `notifPushService`; "none" sends no push */
  pushService: string;
}

export interface PushMessage {
  service: string;
  title: string;
  message: string;
  priority: number;
}

export async function notifyDevice(
  title: string,
  body: string,
  prefs: NotifyPrefs,
  push: (message: PushMessage) => Promise<unknown>,
): Promise<void> {
  if (
    prefs.hasLocal &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    const options = { body, icon: "/icons/pwa-192x192.png" };
    try {
      // Android Chrome only shows notifications through the service worker
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration()
          : undefined;
      if (registration) await registration.showNotification(title, options);
      else new Notification(title, options);
    } catch {
      // The screen itself still says that the goal is reached
    }
  }
  if (prefs.pushService !== "none") {
    await push({
      service: prefs.pushService,
      title,
      message: body,
      priority: 5,
    }).catch(() => undefined);
  }
}
