/**
 * "Workout complete" and record notifications, ported from LiftTrace
 * `lib/notifications.js` (web path): a browser notification plus the push
 * service of the settings, each celebration once. Unlike the old module the
 * day is checked at call time, so an app left open past midnight celebrates
 * again.
 */
import { localDateStr } from "./dates";
import { safeStorage } from "./store";

const DAY_KEY = "lt:celebratedToday";

/** True the first time per day; remembers it */
export function claimDaily(id: string, day: string = localDateStr()): boolean {
  const stored = safeStorage.read(DAY_KEY) as {
    day: string;
    ids: string[];
  } | null;
  const ids =
    stored?.day === day && Array.isArray(stored.ids) ? stored.ids : [];
  if (ids.includes(id)) return false;
  safeStorage.write(DAY_KEY, { day, ids: [...ids, id] });
  return true;
}

/**
 * True when `value` beats what was already celebrated for this exercise
 * today (a heavier lift, a longer hold); remembers it.
 */
export function claimRecord(
  kind: "pr" | "prHold",
  exerciseName: string,
  value: number,
  day: string = localDateStr(),
): boolean {
  const key = `lt:${kind}Celebrated:${exerciseName}:${day}`;
  if (value <= Number(safeStorage.read(key) ?? 0)) return false;
  safeStorage.write(key, value);
  return true;
}

export interface NotifyPrefs {
  hasLocal: boolean;
  /** Setting `notifPushService`; "none" sends no push */
  pushService: string;
}

export async function notify(
  title: string,
  body: string,
  prefs: NotifyPrefs,
  push: (title: string, body: string) => Promise<unknown>,
): Promise<void> {
  if (
    prefs.hasLocal &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    const options = {
      body,
      icon: "/icons/pwa-192x192.png",
      tag: `lt-${Date.now()}`,
    };
    try {
      // Android Chrome only shows notifications through the service worker
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration()
          : undefined;
      if (registration) await registration.showNotification(title, options);
      else new Notification(title, options);
    } catch {
      // No notification: the summary on screen still celebrates
    }
  }
  if (prefs.pushService !== "none") {
    await push(title, body).catch(() => undefined);
  }
}
