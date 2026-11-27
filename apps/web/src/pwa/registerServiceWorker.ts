import { registerSW } from "virtual:pwa-register";

let registration: ServiceWorkerRegistration | undefined;

/** Registers the app-shell service worker; updates apply on the next load */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onRegisteredSW: (_url, registered) => {
      registration = registered;
    },
  });
}

/**
 * Asks whether a new version of Trace is deployed (the browser itself only
 * looks on a page load, or once a day). A new one takes over and reloads.
 */
export async function checkForAppUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {
    // Offline: the next check will tell.
  }
}

/** How long a reload waits for the new service worker to take over */
const TAKEOVER_TIMEOUT_MS = 15_000;

/**
 * Loads the deployed version: fetches the new service worker first and waits
 * until it has taken over, or the reload would get the old app from the cache.
 */
export async function reloadToLatestVersion(): Promise<void> {
  await checkForAppUpdate();
  const next = registration?.installing ?? registration?.waiting;
  if (next) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, TAKEOVER_TIMEOUT_MS);
      const check = () => {
        if (next.state !== "activated" && next.state !== "redundant") return;
        window.clearTimeout(timeout);
        resolve();
      };
      next.addEventListener("statechange", check);
      check();
    });
  }
  window.location.reload();
}
