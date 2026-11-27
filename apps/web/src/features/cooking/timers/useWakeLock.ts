import { useEffect } from "react";

/**
 * Keeps the screen on while `isActive`. The browser drops the lock when
 * the tab is hidden, so it is taken again when it comes back.
 */
export function useWakeLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let isReleased = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (isReleased) await next.release();
        else lock = next;
      } catch {
        // refused (battery saver, hidden tab): cooking works without it
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      isReleased = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [isActive]);
}
