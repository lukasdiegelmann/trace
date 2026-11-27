/**
 * Screen keep-awake, ported from LiftTrace `stores/wakeLock.js`: the user's
 * intent survives the browser releasing the lock (tab switch), and it is
 * taken again when the page is visible.
 */
import { createStore } from "./store";

export interface WakeLockState {
  isWanted: boolean;
  isActive: boolean;
}

export const wakeLock = createStore<WakeLockState>({
  isWanted: false,
  isActive: false,
});

let sentinel: WakeLockSentinel | null = null;
let isListening = false;

function patch(next: Partial<WakeLockState>) {
  const state = { ...wakeLock.get(), ...next };
  const current = wakeLock.get();
  if (
    state.isWanted !== current.isWanted ||
    state.isActive !== current.isActive
  ) {
    wakeLock.set(state);
  }
}

async function acquire(): Promise<void> {
  if (sentinel || !("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    patch({ isActive: true });
    sentinel.addEventListener("release", () => {
      sentinel = null;
      patch({ isActive: false });
    });
  } catch {
    sentinel = null;
    patch({ isActive: false });
  }
}

export async function enableWakeLock(): Promise<void> {
  if (!isListening) {
    isListening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && wakeLock.get().isWanted) {
        void acquire();
      }
    });
  }
  patch({ isWanted: true });
  await acquire();
}

export async function disableWakeLock(): Promise<void> {
  patch({ isWanted: false });
  try {
    await sentinel?.release();
  } catch {
    // Already released
  }
  sentinel = null;
  patch({ isActive: false });
}

export function toggleWakeLock(): Promise<void> {
  return wakeLock.get().isWanted ? disableWakeLock() : enableWakeLock();
}
