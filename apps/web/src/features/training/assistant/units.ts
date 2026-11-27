import { settingsStores } from "@/features/shared/settings";

import { getLtSettings } from "../diary/ltSettings";

/** The user's weight unit, once the settings are there */
export async function weightUnit(): Promise<string> {
  await settingsStores.lt.ensureLoaded();
  return getLtSettings().weightUnit;
}
