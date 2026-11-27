/**
 * The targets of one day, from Diary.svelte: the calorie goal of the chosen
 * mode, macro targets and the nutrient bars. One basis everywhere: a percent
 * macro converts on the day's resolved calorie goal (upstream mixed three).
 */
import type { AdaptiveTdee, Goals } from "../api";
import { macroGoalGrams, resolveGoalFor } from "./goalResolver";
import {
  KJ_PER_KCAL,
  MACRO_DENSITY,
  NUTRIMENTS,
  type NutritionValues,
} from "./nutrition";

export const DEFAULT_CALORIE_GOAL = 2000;

export type CalorieGoalMode = "fixed" | "dynamic" | "adaptive";

export interface CalorieGoalInput {
  goals: Goals;
  date: string;
  mode: CalorieGoalMode;
  factor: number;
  /** Yesterday's wearable burn */
  caloriesOut: number | null;
  adaptive: AdaptiveTdee | null;
}

export interface CalorieGoal {
  /** kcal before today's activity */
  kcal: number;
  /** What it comes from; `fixed` also when a mode has no data yet */
  source: CalorieGoalMode;
}

export function calorieGoal(input: CalorieGoalInput): CalorieGoal {
  if (input.mode === "dynamic" && input.caloriesOut != null) {
    return {
      kcal: Math.round(input.caloriesOut * input.factor),
      source: "dynamic",
    };
  }
  if (
    input.mode === "adaptive" &&
    input.adaptive?.ready &&
    input.adaptive.tdee != null
  ) {
    return {
      kcal: Math.round(input.adaptive.tdee * input.factor),
      source: "adaptive",
    };
  }
  return {
    kcal:
      resolveGoalFor(input.goals.calories, input.date) ?? DEFAULT_CALORIE_GOAL,
    source: "fixed",
  };
}

/** 0..100; 0 for a missing or zero goal */
export function percentOf(
  value: number,
  goal: number | null | undefined,
): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / goal) * 100)));
}

/** A nutrient's target for the day, percent macros as grams; null without one */
export function targetFor(
  goals: Goals,
  id: string,
  date: string,
  calGoalKcal: number,
): number | null {
  const goal = goals[id];
  if (!goal) return null;
  const raw = resolveGoalFor(goal, date);
  if (raw == null) return null;
  return macroGoalGrams(
    { max: raw, isPercent: goal.isPercent },
    calGoalKcal,
    MACRO_DENSITY[id],
  );
}

export interface NutrientBar {
  id: string;
  unit: string;
  current: number;
  target: number;
  /** Past a maximum goal */
  isOver: boolean;
  /** Which macro it belongs to, for its colour */
  macro: "protein" | "carbs" | "fat" | null;
}

const BAR_MACROS: Partial<Record<string, "protein" | "carbs" | "fat">> = {
  proteins: "protein",
  carbohydrates: "carbs",
  sugars: "carbs",
  "added-sugars": "carbs",
  fiber: "carbs",
  fat: "fat",
  "saturated-fat": "fat",
};

const MAX_BARS = 8;

/** The bottom bar's nutrients: default ones with a goal shown in the diary */
export function nutrientBars(
  goals: Goals,
  totals: NutritionValues,
  date: string,
  calGoalKcal: number,
  energyUnit: "kcal" | "kJ",
): NutrientBar[] {
  const bars: NutrientBar[] = [];
  for (const nutrient of NUTRIMENTS) {
    if (!nutrient.isDefault) continue;
    const goal = goals[nutrient.id];
    if (!goal || goal.showInDiary === false) continue;
    let target =
      nutrient.id === "calories"
        ? calGoalKcal
        : targetFor(goals, nutrient.id, date, calGoalKcal);
    if (target == null) continue;
    let current = totals[nutrient.id] || 0;
    let unit = nutrient.unit;
    if (nutrient.id === "calories" && energyUnit === "kJ") {
      target *= KJ_PER_KCAL;
      current *= KJ_PER_KCAL;
      unit = "kJ";
    }
    bars.push({
      id: nutrient.id,
      unit,
      current,
      target,
      isOver: target > 0 && current > target && !goal.isMin,
      macro: BAR_MACROS[nutrient.id] ?? null,
    });
    if (bars.length === MAX_BARS) break;
  }
  return bars;
}
