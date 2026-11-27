/** The units overlay (disabled built-ins, custom units), loaded once */
import { useEffect, useSyncExternalStore } from "react";

import { manageApi } from "../manageApi";
import type { UnitsOverlay } from "../lib/units";

const EMPTY: UnitsOverlay = { disabled: [], custom: [] };
let overlay: UnitsOverlay = EMPTY;
let isRequested = false;
const listeners = new Set<() => void>();

/** Reads the overlay again, e.g. after Manage changed a unit */
export async function refreshUnits(): Promise<void> {
  isRequested = true;
  try {
    overlay = await manageApi.units();
  } catch {
    // The built-ins still work; the next picker asks again.
    isRequested = false;
    return;
  }
  for (const listener of listeners) listener();
}

export function useUnitsOverlay(): UnitsOverlay {
  useEffect(() => {
    if (!isRequested) void refreshUnits();
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => overlay,
  );
}
