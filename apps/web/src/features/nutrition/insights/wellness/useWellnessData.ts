import { useCallback, useState } from "react";

import { addDays, daysBetween, localDateStr } from "../../lib/insights/dates";
import { flattenWithings } from "../../lib/insights/wellness";
import {
  getFitbitData,
  getGarminData,
  getStatus,
  getWithingsData,
  getWorkouts,
  orEmpty,
} from "../api";
import { useAsync } from "../useAsync";
import type { InsightSettings } from "../useNtSettings";

/** Days of history the sleep insights, readiness and sparklines look at */
const HISTORY_DAYS = 45;

/**
 * Everything the Wellness page reads: the connection status of the
 * providers, the shown day, the recent history and the day's workouts.
 * `refresh()` reads it all again (after a sync or a disconnect).
 */
export function useWellnessData(date: string, settings: InsightSettings) {
  const { isFitbitFamilyEnabled, isGarminEnabled, isWithingsEnabled } =
    settings;
  const hasWorkouts = settings.values.workoutsEnabled;
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const loadStatuses = useCallback(async () => {
    const [fitbit, withings, garmin] = await Promise.all([
      getStatus("fitbit"),
      getStatus("withings"),
      getStatus("garmin"),
    ]);
    return { fitbit, withings, garmin, version };
  }, [version]);

  const loadDay = useCallback(async () => {
    const [fitbit, garmin, withings] = await Promise.all([
      orEmpty(isFitbitFamilyEnabled, () => getFitbitData({ date })),
      orEmpty(isGarminEnabled, () => getGarminData({ date })),
      orEmpty(isWithingsEnabled, () => getWithingsData({ date })),
    ]);
    return {
      date,
      version,
      fitbit: fitbit[date] ?? {},
      garmin: garmin[date] ?? {},
      withings: flattenWithings(withings),
    };
  }, [
    date,
    version,
    isFitbitFamilyEnabled,
    isGarminEnabled,
    isWithingsEnabled,
  ]);

  const loadHistory = useCallback(async () => {
    const today = localDateStr();
    const from = addDays(today, -(HISTORY_DAYS - 1));
    const [fitbit, garmin] = await Promise.all([
      orEmpty(isFitbitFamilyEnabled, () => getFitbitData({ from, to: today })),
      orEmpty(isGarminEnabled, () => getGarminData({ from, to: today })),
    ]);
    return { days: daysBetween(from, today), fitbit, garmin, version };
  }, [version, isFitbitFamilyEnabled, isGarminEnabled]);

  const loadWorkouts = useCallback(async () => {
    const list = hasWorkouts ? await getWorkouts(date).catch(() => []) : [];
    return { date, version, list: Array.isArray(list) ? list : [] };
  }, [date, version, hasWorkouts]);

  return {
    statuses: useAsync(loadStatuses),
    day: useAsync(loadDay),
    history: useAsync(loadHistory),
    workouts: useAsync(loadWorkouts),
    refresh,
  };
}
