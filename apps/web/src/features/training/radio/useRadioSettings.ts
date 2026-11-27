import { useCallback, useMemo } from "react";

import { settingsStores, useSettings } from "@/features/shared/settings";

import {
  isMusicAvailable,
  parseStations,
  shouldShowRadioNav,
  type Station,
} from "../lib/radio";
import type { ProviderConfig } from "./provider";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The radio part of LiftTrace's settings, narrowed */
export function useRadioSettings() {
  const { values, status, error, reload } = useSettings("lt");
  const stations = useMemo(
    () => parseStations(values.radioStations),
    [values.radioStations],
  );
  const url = asText(values.radioUrl);
  const provider = asText(values.radioProvider) || "subsonic";
  const user = asText(values.radioUser);
  const password = asText(values.radioPassword);
  const config = useMemo<ProviderConfig & { url: string }>(
    () => ({ provider, url, user, password }),
    [provider, url, user, password],
  );
  const saveStations = useCallback((next: Station[]) => {
    settingsStores.lt.set("radioStations", next);
  }, []);

  return {
    status,
    error,
    reload,
    config,
    stations,
    saveStations,
    hasMusic: isMusicAvailable(values.radioEnabled, url),
    hasStations: values.radioStationsEnabled,
  };
}

export type RadioSettings = ReturnType<typeof useRadioSettings>;

/** Whether the navigation should offer the Radio section */
export function useShowRadioNav(): boolean {
  const { values } = useSettings("lt");
  return shouldShowRadioNav(
    values.radioEnabled,
    values.radioUrl,
    values.radioStationsEnabled,
  );
}
