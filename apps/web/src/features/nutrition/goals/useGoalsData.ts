import { useEffect, useState } from "react";

import { diaryApi, wellnessApi } from "../api";
import { loadDiaryDay } from "../diaryStore";
import { GOAL_BODY_STATS } from "../lib/goals";
import { readBodyStat } from "../lib/bodyStats";
import { addDays, localDateStr } from "../lib/dates";
import { dayTotals, waterTotal } from "../lib/diary";
import { useNtSettings } from "../settings";
import { useResource } from "../useResource";

/** Today, rolling over when the tab is looked at again */
function useToday(): string {
  const [today, setToday] = useState(() => localDateStr());
  useEffect(() => {
    const check = () => {
      setToday(localDateStr());
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return today;
}

export interface Reading {
  value: number;
  /** Set when it is not from today */
  date: string | null;
}

export interface GoalsData {
  today: string;
  /** How far today is on each stat */
  current: (statId: string) => Reading | null;
  waterMl: number;
}

/**
 * What the goals are compared with: today's totals and water, body stats
 * from today or the last 30 days, and today's wearable values.
 */
export function useGoalsData(): GoalsData {
  const { settings } = useNtSettings();
  const today = useToday();
  const { weightUnit, lengthUnit } = settings;
  const hasFitbit =
    settings.fitbitEnabled ||
    settings.googleHealthEnabled ||
    settings.healthConnectEnabled;
  const hasGarmin = settings.garminEnabled;

  const day = useResource(`goals-day-${today}`, () => loadDiaryDay(today));
  const history = useResource(`goals-history-${today}`, () => diaryApi.all());
  const wellness = useResource(
    settings.wellnessEnabled && (hasFitbit || hasGarmin)
      ? `goals-wellness-${today}-${String(hasFitbit)}-${String(hasGarmin)}`
      : null,
    async () => {
      const [fitbit, garmin] = await Promise.all([
        hasFitbit
          ? wellnessApi.fitbitData(today).catch(() => null)
          : Promise.resolve(null),
        hasGarmin
          ? wellnessApi.garminData(today).catch(() => null)
          : Promise.resolve(null),
      ]);
      // Garmin wins where both have a value
      return { ...fitbit?.[today], ...garmin?.[today] };
    },
  );

  const totals = dayTotals(day.data?.items ?? []);
  const oldest = addDays(today, -30);

  const current = (statId: string): Reading | null => {
    if ((GOAL_BODY_STATS as readonly string[]).includes(statId)) {
      const own = readBodyStat(
        day.data?.body_stats,
        statId,
        weightUnit,
        lengthUnit,
      );
      if (own !== null) return { value: own, date: null };
      let latest: Reading | null = null;
      for (const entry of history.data ?? []) {
        if (entry.date < oldest || entry.date > today) continue;
        const value = readBodyStat(
          entry.body_stats,
          statId,
          weightUnit,
          lengthUnit,
        );
        if (value === null) continue;
        if (!latest?.date || entry.date > latest.date) {
          latest = { value, date: entry.date };
        }
      }
      return latest;
    }
    const wearable = wellness.data?.[statId];
    if (wearable !== undefined) return { value: wearable, date: null };
    return statId in totals ? { value: totals[statId], date: null } : null;
  };

  return { today, current, waterMl: waterTotal(day.data?.water ?? []) };
}
