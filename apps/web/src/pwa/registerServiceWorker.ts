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
