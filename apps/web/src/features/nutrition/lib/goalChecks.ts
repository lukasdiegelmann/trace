/**
 * When goals are celebrated, from nutritrace/src/stores/diary.js (after every
 * save of today) and routes/Wellness.svelte and lib/sync.js (after a
 * wearable sync). The notifications themselves are the shared ones.
 */

import {
  checkGoals,
  checkStepGoal,
  type CelebrationText,
  type GoalTarget,
} from "@/features/shared/notifications";
import { settingsStores } from "@/features/shared/settings";
import { i18n } from "@/i18n";

import type { DiaryDay, Goals } from "../api";
import { getFitbitData, getGarminData, orEmpty } from "../insights/api";
import { toNtSettings } from "../settings";
import { targetFor } from "./dayGoals";
import { localDateStr } from "./dates";
import { dayTotals, waterTotal } from "./diary";
import { mergeDisplayData } from "./insights/wellness";
import { resolveGoalFor } from "./goalResolver";
import { NUTRIMENTS } from "./nutrition";

const OWN_LABELS = [
  "water_ml",
  "sleep_duration_min",
  "steps",
  "active_minutes",
  "distance_km",
  "calories_out",
] as const;

type OwnLabel = (typeof OWN_LABELS)[number];

const OWN_UNITS: Record<OwnLabel, string> = {
  water_ml: "ml",
  sleep_duration_min: "min",
  steps: "",
  active_minutes: "min",
  distance_km: "km",
  calories_out: "kcal",
};

function isOwnLabel(key: string): key is OwnLabel {
  return (OWN_LABELS as readonly string[]).includes(key);
}

function goalLabel(key: string): string {
  if (isOwnLabel(key)) {
    return i18n.t(`nutrition:assistant.celebrations.labels.${key}`);
  }
  const nutrient = NUTRIMENTS.find((entry) => entry.id === key);
  return nutrient
    ? i18n.t(`nutrition:nutrients.${nutrient.id as "calories"}`)
    : key;
}

function goalUnit(key: string): string {
  if (isOwnLabel(key)) return OWN_UNITS[key];
  return NUTRIMENTS.find((entry) => entry.id === key)?.unit ?? "";
}

/** The celebrations in the UI's language */
export function celebrationText(): CelebrationText {
  const number = (value: number) =>
    Math.round(value).toLocaleString(i18n.language);
  return {
    goal: (key, value, target) => [
      i18n.t("nutrition:assistant.celebrations.goalTitle"),
      i18n.t("nutrition:assistant.celebrations.goalText", {
        label: goalLabel(key),
        value: `${number(value)} ${goalUnit(key)}`.trim(),
        target: number(target),
      }),
    ],
    calories: (value, target) => [
      i18n.t("nutrition:assistant.celebrations.caloriesTitle"),
      i18n.t("nutrition:assistant.celebrations.caloriesText", {
        value: number(value),
        target: number(target),
      }),
    ],
    stepsReached: (steps, goal) => [
      i18n.t("nutrition:assistant.celebrations.stepsTitle"),
      i18n.t("nutrition:assistant.celebrations.stepsText", {
        steps: number(steps),
        goal: number(goal),
      }),
    ],
    stepsMidday: (steps, remaining) => [
      i18n.t("nutrition:assistant.celebrations.middayTitle"),
      i18n.t("nutrition:assistant.celebrations.middayText", {
        steps: number(steps),
        remaining: number(remaining),
      }),
    ],
  };
}

/**
 * The goals as `date` has them: per-weekday targets and percent macros as
 * plain numbers (the stored min/max of those are the week's peak or percent)
 */
export function goalTargets(
  goals: Goals,
  date: string,
): Partial<Record<string, GoalTarget>> {
  const calories = resolveGoalFor(goals.calories, date) ?? 2000;
  const out: Partial<Record<string, GoalTarget>> = {};
  for (const [key, goal] of Object.entries(goals)) {
    if (!goal) continue;
    if (goal.sharedGoal !== false && !goal.isPercent) {
      out[key] = { min: goal.min, max: goal.max };
      continue;
    }
    const target = targetFor(goals, key, date, calories);
    out[key] = {
      min: goal.min != null ? target : null,
      max: goal.max != null ? target : null,
    };
  }
  return out;
}

async function loadSettings() {
  await settingsStores.nt.ensureLoaded();
  return toNtSettings(settingsStores.nt.getSnapshot().values);
}

/** After a save: today's food and water against the goals */
export async function checkDiaryGoals(
  day: DiaryDay,
  now: Date = new Date(),
): Promise<void> {
  const today = localDateStr(now);
  if (day.date !== today) return;
  if (day.items.length === 0 && day.water.length === 0) return;
  const settings = await loadSettings();
  const goals = goalTargets(settings.goals, today);
  if (settings.waterGoalMl > 0) goals.water_ml = { min: settings.waterGoalMl };
  await checkGoals(
    goals,
    { ...dayTotals(day.items), water_ml: waterTotal(day.water) },
    celebrationText(),
    now,
  );
}

const WELLNESS_GOALS = [
  "sleep_duration_min",
  "active_minutes",
  "distance_km",
  "calories_out",
] as const;

/** After a wearable sync: today's steps and wellness values */
export async function checkWellnessGoals(
  now: Date = new Date(),
): Promise<void> {
  const today = localDateStr(now);
  const [fitbit, garmin, settings] = await Promise.all([
    orEmpty(true, () => getFitbitData({ date: today })),
    orEmpty(true, () => getGarminData({ date: today })),
    loadSettings(),
  ]);
  const metrics = mergeDisplayData(garmin[today] ?? {}, fitbit[today] ?? {}, {
    isGarminEnabled: true,
    isFitbitFamilyEnabled: true,
  });
  const goals = goalTargets(settings.goals, today);
  const text = celebrationText();
  const stepGoal = goals.steps?.min || goals.steps?.max;
  const steps = Number(metrics.steps) || 0;
  if (steps && stepGoal) await checkStepGoal(steps, stepGoal, text, now);
  // Steps are left out: checkStepGoal has them
  const values: Record<string, number> = {};
  for (const key of WELLNESS_GOALS) {
    const value = Number(metrics[key]);
    if (value) values[key] = value;
  }
  if (Object.keys(values).length > 0) {
    await checkGoals(goals, values, text, now);
  }
}
