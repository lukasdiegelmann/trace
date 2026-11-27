import { useSyncExternalStore } from "react";

import { playerStore, type PlayerState } from "./player";

/** One value of the player; the component renders when it changes */
export function usePlayer<K extends keyof PlayerState>(key: K): PlayerState[K] {
  return useSyncExternalStore(
    playerStore.subscribe,
    () => playerStore.getSnapshot()[key],
  );
}
