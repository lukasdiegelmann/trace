/** The tools that only look things up (Trace.svelte's executors) */

import { api } from "@/api";

import {
  activityApi,
  diaryApi,
  fastsApi,
  mealsApi,
  wellnessApi,
  type DiaryItem,
  type MealRow,
} from "../api";
import { loadDiaryDay } from "../diaryStore";
import {
  getFitbitData,
  getGarminData,
  getWithingsData,
  orEmpty,
  type Workout,
} from "../insights/api";
import { LENGTH_KEYS, readBodyStat } from "../lib/bodyStats";
import { dayTotals, mealIndexOf, waterTotal } from "../lib/diary";
import { fastingStats } from "../lib/insights/fasting";
import { calculate, sumNutrition } from "../lib/nutrition";
import { foldText } from "../lib/searchText";
import { textArg, type Args } from "./args";
import { diaryAverages, loggingStreak } from "./diaryHistory";
import { loadAssistantSettings, mealNamesOf } from "./settings";
import { convertWellnessUnits, milesOf } from "./wellnessUnits";

async function getWellnessData(args: Args) {
  const query = { from: textArg(args.from), to: textArg(args.to) };
  const [fitbit, garmin, units] = await Promise.all([
    orEmpty(true, () => getFitbitData(query)),
    orEmpty(true, () => getGarminData(query)),
    loadAssistantSettings(),
  ]);
  const merged: Partial<Record<string, object>> = { ...garmin };
  for (const [date, values] of Object.entries(fitbit)) {
    merged[date] = { ...merged[date], ...values };
  }
  return convertWellnessUnits(merged, units);
}

async function getBodyComposition(args: Args) {
  const query = { from: textArg(args.from), to: textArg(args.to) };
  const [data, units] = await Promise.all([
    orEmpty(true, () => getWithingsData(query)),
    loadAssistantSettings(),
  ]);
  return convertWellnessUnits(data, units);
}

function itemRow(item: {
  name: string;
  portion?: number;
  unit?: string;
  quantity?: number;
  brand?: string | null;
  notes?: unknown;
}) {
  const notes = textArg(item.notes);
  return {
    name: item.name,
    portion: item.portion,
    unit: item.unit,
    quantity: item.quantity,
    ...(item.brand ? { brand: item.brand } : {}),
    ...(notes ? { notes } : {}),
  };
}

function mealsOfDay(items: DiaryItem[], names: string[]) {
  const meals: Record<string, object[]> = {};
  for (const item of items) {
    const index = mealIndexOf(item);
    const name = names[index] || `Meal ${index + 1}`;
    (meals[name] ??= []).push({
      ...itemRow(item),
      calories: Math.round(calculate(item).calories || 0),
    });
  }
  return meals;
}

async function getDiary(args: Args) {
  const date = textArg(args.date);
  try {
    // Manual activity is its own table
    const [day, activities, settings] = await Promise.all([
      loadDiaryDay(date),
      activityApi.day(date).catch(() => []),
      loadAssistantSettings(),
    ]);
    const hasItems = day.items.length > 0;
    const totals = dayTotals(day.items);
    // Readings keep the unit they were written in; say which one is given
    const { weightUnit, lengthUnit } = settings;
    const stored = day.body_stats;
    const bodyStats: Record<string, unknown> = {};
    const weight = readBodyStat(stored, "weight", weightUnit, lengthUnit);
    if (weight != null) {
      bodyStats.weight = weight;
      bodyStats.weight_unit = weightUnit;
    }
    for (const [key, name] of [
      ["body_fat", "body_fat_pct"],
      ["body_water", "body_water_pct"],
    ] as const) {
      const value = readBodyStat(stored, key, weightUnit, lengthUnit);
      if (value != null) bodyStats[name] = value;
    }
    for (const key of LENGTH_KEYS) {
      const value = readBodyStat(stored, key, weightUnit, lengthUnit);
      if (value != null) {
        bodyStats[key] = value;
        bodyStats.length_unit = lengthUnit;
      }
    }
    const notes = day.notes.trim();
    return {
      date,
      meals: mealsOfDay(day.items, mealNamesOf(settings)),
      totals: hasItems
        ? {
            calories: Math.round(totals.calories || 0),
            protein: Math.round(totals.proteins || 0),
            carbs: Math.round(totals.carbohydrates || 0),
            fat: Math.round(totals.fat || 0),
          }
        : null,
      body_stats: bodyStats,
      water_ml: waterTotal(day.water),
      ...(notes ? { day_notes: notes } : {}),
      ...(Array.isArray(activities) && activities.length > 0
        ? {
            activities: activities.map((activity) => ({
              name: activity.name,
              kcal: activity.kcal,
              duration_min: activity.duration_min,
              distance: activity.distance,
              source: activity.source,
            })),
          }
        : {}),
    };
  } catch {
    return { date, error: "Could not load diary" };
  }
}

function savedMeal(meal: MealRow, kind: "meal" | "recipe") {
  const items = meal.items.map(itemRow);
  const totals = sumNutrition(meal.items.map(calculate));
  const notes = textArg(meal.notes);
  return {
    id: meal.id,
    name: meal.name,
    kind,
    item_count: items.length,
    calories: Math.round(totals.calories || 0),
    protein_g: Math.round(totals.proteins || 0),
    carbs_g: Math.round(totals.carbohydrates || 0),
    fat_g: Math.round(totals.fat || 0),
    items,
    ...(notes ? { notes } : {}),
  };
}

const MAX_MEALS = 50;

async function getMeals(args: Args) {
  const [meals, recipes] = await Promise.all([
    mealsApi.list().catch(() => []),
    mealsApi.recipes().catch(() => []),
  ]);
  const query = foldText(textArg(args.query)).trim();
  const list = [
    ...meals.map((meal) => savedMeal(meal, "meal")),
    ...recipes.map((recipe) => savedMeal(recipe, "recipe")),
  ].filter((meal) => !query || foldText(meal.name).includes(query));
  return { count: list.length, meals: list.slice(0, MAX_MEALS) };
}

async function getWearableWorkouts(args: Args) {
  const [workouts, settings] = await Promise.all([
    api.nt
      .get<Workout[]>("/wellness/fitbit/workouts", {
        query: { from: textArg(args.from), to: textArg(args.to) },
      })
      .catch((): Workout[] => []),
    loadAssistantSettings(),
  ]);
  if (settings.distUnit !== "mi") return workouts;
  return workouts.map((workout) => {
    if (workout.distance_km == null) return workout;
    const { distance_km: km, ...rest } = workout;
    return { ...rest, distance_mi: milesOf(km) };
  });
}

async function getFastingHistory(args: Args) {
  try {
    const days = Math.min(
      365,
      Math.max(1, parseInt(String(args.days), 10) || 30),
    );
    const [history, running] = await Promise.all([
      fastsApi.history(days).catch(() => []),
      fastsApi.active().catch(() => null),
    ]);
    const active = running?.id ? running : null;
    const hoursBetween = (start: string, end: number) =>
      Math.round((end - new Date(start).getTime()) / 360000) / 10;
    return {
      active_fast: active
        ? {
            start_at: active.start_at,
            goal_hours: active.goal_hours,
            elapsed_hours: hoursBetween(active.start_at, Date.now()),
          }
        : null,
      stats: fastingStats(history, active),
      history: history.map((fast) => ({
        start_at: fast.start_at,
        end_at: fast.end_at,
        duration_hours: fast.end_at
          ? hoursBetween(fast.start_at, new Date(fast.end_at).getTime())
          : null,
        goal_hours: fast.goal_hours,
        met_goal: fast.end_at
          ? (new Date(fast.end_at).getTime() -
              new Date(fast.start_at).getTime()) /
              3600000 >=
            (fast.goal_hours || 16)
          : null,
      })),
    };
  } catch {
    return { error: "Could not load fasting history." };
  }
}

async function getActivityLog(args: Args) {
  const from = textArg(args.from);
  const to = textArg(args.to);
  if (!from || !to) return { error: "from and to dates required" };
  const list = await activityApi.range(from, to).catch(() => []);
  return Array.isArray(list) ? list : [];
}

export const readTools = {
  get_wellness_data: getWellnessData,
  get_body_composition: getBodyComposition,
  get_diary: getDiary,
  get_meals: getMeals,
  get_wearable_workouts: getWearableWorkouts,
  get_goals: async () => (await loadAssistantSettings()).goals,
  get_diary_averages: async (args: Args) => {
    try {
      // One request for the whole diary, however long the period
      return diaryAverages(await diaryApi.all(), args.days);
    } catch {
      return { error: "Could not compute diary averages." };
    }
  },
  get_logging_streak: async () => {
    try {
      return loggingStreak(await diaryApi.all());
    } catch (caught) {
      return {
        error:
          "Could not compute streak: " +
          (caught instanceof Error ? caught.message : String(caught)),
      };
    }
  },
  get_fasting_history: getFastingHistory,
  get_adaptive_tdee: async () => {
    try {
      return await wellnessApi.adaptiveTdee();
    } catch {
      return { ready: false, error: "Could not load adaptive TDEE." };
    }
  },
  get_activity_log: getActivityLog,
};
