import { api, type BackendId } from "@/api";

import { ctDefaults, ctSyncedKeys, type CtSettings } from "./definitions/ct";
import { ltDefaults, ltSyncedKeys, type LtSettings } from "./definitions/lt";
import { ntDefaults, ntSyncedKeys, type NtSettings } from "./definitions/nt";
import { createSettingsStore, type SettingsStore } from "./store";

/** The settings shape of each backend */
export interface BackendSettings {
  nt: NtSettings;
  ct: CtSettings;
  lt: LtSettings;
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** One store per backend for the whole app, on the app's `api` clients */
export const settingsStores: {
  [B in BackendId]: SettingsStore<BackendSettings[B]>;
} = {
  nt: createSettingsStore({
    client: api.nt,
    defaults: ntDefaults,
    syncedKeys: ntSyncedKeys,
    storage: browserStorage(),
  }),
  ct: createSettingsStore({
    client: api.ct,
    defaults: ctDefaults,
    syncedKeys: ctSyncedKeys,
    storage: browserStorage(),
  }),
  lt: createSettingsStore({
    client: api.lt,
    defaults: ltDefaults,
    syncedKeys: ltSyncedKeys,
    storage: browserStorage(),
  }),
};
