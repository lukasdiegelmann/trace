/**
 * The NutriTrace settings Statistics and Wellness use, on the shared store
 * (`@/features/shared/settings`), with the list- and object-valued keys
 * narrowed to their shapes.
 */
import { useMemo } from "react";

import {
  settingsStores,
  useSettings,
  type NtSettings,
} from "@/features/shared/settings";

import type { Goals } from "../lib/insights/goals";

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

export interface InsightSettings {
  /** The backend has answered (or failed): the values are what it has */
  isReady: boolean;
  values: NtSettings;
  goals: Goals;
  hiddenBodyStats: string[];
  bodyStatsOrder: string[];
  statsMetricOrder: string[];
  statsHiddenMetrics: string[];
  /** null: every wellness metric is visible */
  wellnessMetrics: string[] | null;
  /** Fitbit, Google Health or Health Connect (stores/settings.js) */
  isFitbitFamilyEnabled: boolean;
  isGarminEnabled: boolean;
  isWithingsEnabled: boolean;
  set: <K extends keyof NtSettings>(key: K, value: NtSettings[K]) => void;
}

export function useNtSettings(): InsightSettings {
  const { values, status } = useSettings("nt");
  return useMemo(
    () => ({
      isReady: status === "ready" || status === "error",
      values,
      goals: (values.goals as Goals | null) ?? {},
      hiddenBodyStats: strings(values.hiddenBodyStats),
      bodyStatsOrder: strings(values.bodyStatsOrder),
      statsMetricOrder: strings(values.statsMetricOrder),
      statsHiddenMetrics: strings(values.statsHiddenMetrics),
      wellnessMetrics: Array.isArray(values.wellnessMetrics)
        ? strings(values.wellnessMetrics)
        : null,
      isFitbitFamilyEnabled:
        values.fitbitEnabled ||
        values.googleHealthEnabled ||
        values.healthConnectEnabled,
      isGarminEnabled: values.garminEnabled,
      isWithingsEnabled: values.withingsEnabled,
      set: settingsStores.nt.set,
    }),
    [values, status],
  );
}
