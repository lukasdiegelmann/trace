import { useEffect } from "react";

import { activityApi, wellnessApi } from "../api";
import { subscribeDiaryChanges } from "../diaryStore";
import { calorieGoal, type CalorieGoal } from "../lib/dayGoals";
import { useNtSettings } from "../settings";
import { useResource, type Resource } from "../useResource";
import type {
  ActivityRow,
  ActivitySum,
  AdaptiveTdee,
  CaloriesOut,
} from "../api";

export interface DayGoalState {
  goal: CalorieGoal;
  /** The goal plus today's activity, where the settings say so */
  adjustedKcal: number;
  /** Activity added on top of the goal, 0 when it isn't */
  addedActivityKcal: number;
  caloriesOut: CaloriesOut | null;
  adaptive: AdaptiveTdee | null;
  activity: Resource<{ rows: ActivityRow[]; sum: ActivitySum }>;
}

/** The calorie target of `date`: its mode's data and the day's activity */
export function useDayGoal(date: string): DayGoalState {
  const { settings } = useNtSettings();
  const mode = settings.calorieGoalMode;
  const policy = settings.manualActivityPolicy;

  const caloriesOut = useResource(mode === "dynamic" ? date : null, () =>
    wellnessApi.caloriesOut(date),
  );
  const adaptive = useResource(mode === "adaptive" ? "adaptive" : null, () =>
    wellnessApi.adaptiveTdee(),
  );
  const activity = useResource(
    settings.diaryShowActivity ? `${date}|${policy}` : null,
    async () => {
      const [rows, sum] = await Promise.all([
        activityApi.day(date),
        activityApi.sum(date, policy),
      ]);
      return { rows, sum };
    },
  );

  const { reload: reloadActivity } = activity;
  useEffect(
    () =>
      subscribeDiaryChanges((changed) => {
        if (changed === date) reloadActivity();
      }),
    [date, reloadActivity],
  );

  const goal = calorieGoal({
    goals: settings.goals,
    date,
    mode,
    factor: settings.calorieGoalFactor,
    caloriesOut: caloriesOut.data?.calories_out ?? null,
    adaptive: adaptive.data,
  });
  const addedActivityKcal =
    settings.diaryShowActivity && settings.calorieAdjustFromActivity
      ? (activity.data?.sum.effective ?? 0)
      : 0;

  return {
    goal,
    adjustedKcal: goal.kcal + addedActivityKcal,
    addedActivityKcal,
    caloriesOut: caloriesOut.data,
    adaptive: adaptive.data,
    activity,
  };
}
