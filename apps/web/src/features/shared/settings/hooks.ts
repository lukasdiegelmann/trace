import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { BackendId } from "@/api";

import type { SettingsSnapshot } from "./store";
import { settingsStores, type BackendSettings } from "./stores";

/**
 * All settings of one backend, loaded on first use:
 * `const { values, status } = useSettings("nt")`.
 */
export function useSettings<B extends BackendId>(
  backend: B,
): SettingsSnapshot<BackendSettings[B]> & { reload: () => Promise<void> } {
  const store = settingsStores[backend];
  useEffect(() => {
    void store.ensureLoaded();
  }, [store]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...snapshot, reload: store.reload };
}

/**
 * One setting and its setter, like the old UI's stores:
 * `const [energyUnit, setEnergyUnit] = useSetting("nt", "energyUnit")`.
 * Until the backend has answered, the value is the default.
 */
export function useSetting<
  B extends BackendId,
  K extends keyof BackendSettings[B],
>(
  backend: B,
  key: K,
): [BackendSettings[B][K], (value: BackendSettings[B][K]) => void] {
  const store = settingsStores[backend];
  useEffect(() => {
    void store.ensureLoaded();
  }, [store]);
  const value = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().values[key],
  );
  const setValue = useCallback(
    (next: BackendSettings[B][K]) => {
      store.set(key, next);
    },
    [store, key],
  );
  return [value, setValue];
}
