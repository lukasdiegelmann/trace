/**
 * Keeps the screen on during a long request: a phone that sleeps kills it
 * (#157 upstream, lib/wake-lock.js). Does nothing where unsupported.
 */
export async function acquireScreenWakeLock(): Promise<() => Promise<void>> {
  if (!("wakeLock" in navigator)) return () => Promise.resolve();
  let sentinel: WakeLockSentinel | null = null;
  let isReleased = false;
  const acquire = async () => {
    try {
      const next = await navigator.wakeLock.request("screen");
      if (isReleased) await next.release();
      else sentinel = next;
    } catch {
      // Denied: the request goes on without it
    }
  };
  // The browser drops the lock when the page is hidden
  const onVisible = () => {
    if (document.visibilityState === "visible") void acquire();
  };
  document.addEventListener("visibilitychange", onVisible);
  await acquire();
  return async () => {
    isReleased = true;
    document.removeEventListener("visibilitychange", onVisible);
    await sentinel?.release().catch(() => {});
  };
}
