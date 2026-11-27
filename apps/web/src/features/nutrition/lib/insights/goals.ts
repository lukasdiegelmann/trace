/**
 * Goal helpers for Statistics, after nutritrace/src/lib/goal-resolver.js
 * (`resolveRangeGoal`, #203) and the goal-line math in Statistics.svelte.
 */

/** One entry of the `goals` setting */
export interface Goal {
  min?: number | null;
  max?: number | null;
  /** Macro goal stored as % of the calorie goal */
  isPercent?: boolean;
  /** `false` when every weekday has its own target in `days` */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the stored key
  sharedGoal?: boolean;
  days?: (number | null)[];
}

export type Goals = Record<string, Goal | undefined>;

/**
 * One target for a whole range: shared goals give max ?? min; per-weekday
 * goals the average of their positive days.
 */
export function resolveRangeGoal(goal: Goal | null | undefined): number | null {
  if (!goal) return null;
  if (goal.sharedGoal !== false) return goal.max ?? goal.min ?? null;
  if (Array.isArray(goal.days) && goal.days.length) {
    const values = goal.days
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (values.length) return values.reduce((a, b) => a + b, 0) / values.length;
  }
  return goal.max ?? goal.min ?? null;
}

/** kcal per gram of the macros a goal can be given in % of calories */
export const MACRO_DENSITY: Record<string, number> = {
  fat: 9,
  "saturated-fat": 9,
  carbohydrates: 4,
  sugars: 4,
  proteins: 4,
};

/** The calorie goal a %-macro goal falls back to when none is set */
const DEFAULT_CALORIE_GOAL = 2000;

/**
 * The goal line of a Statistics metric, in the unit the chart shows:
 * %-macro goals turned into grams, calories into kJ when asked.
 */
export function goalValueForMetric(
  goals: Goals,
  metric: string,
  energyUnit: string,
): number | null {
  const goal = goals[metric];
  let value = resolveRangeGoal(goal);
  if (value != null && goal?.isPercent) {
    const density = MACRO_DENSITY[metric];
    const calorieGoal =
      resolveRangeGoal(goals.calories) ?? DEFAULT_CALORIE_GOAL;
    if (density) value = Math.round((calorieGoal * value) / 100 / density);
  }
  if (value != null && metric === "calories" && energyUnit === "kJ") {
    value = Math.round(value * 4.184);
  }
  return value;
}

/** A floor goal (only a minimum): going up is good */
export function isMinimumGoal(goal: Goal | null | undefined): boolean {
  return !!goal && goal.min != null && goal.max == null;
}
