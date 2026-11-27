import { useEffect } from "react";

/** Keeps the screen on while `isActive`, e.g. during a long upload */
export function useWakeLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let isDone = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (isDone) void next.release();
        else lock = next;
      } catch {
        // Refused (battery saver, hidden tab): the upload runs anyway.
      }
    };
    // The browser drops the lock when the tab hides.
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      isDone = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [isActive]);
}
