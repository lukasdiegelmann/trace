/**
 * Resolving a goal entry to its numeric target, ported from
 * nutritrace/src/lib/goal-resolver.js.
 *
 * - `resolveGoalFor(goal, date)`: the target for one calendar day (Diary).
 *   Per-weekday goals (`sharedGoal === false` with seven `days`) resolve to
 *   `days[weekday]`; shared goals to `max ?? min`.
 * - `resolveRangeGoal(goal)`: one representative target for a period
 *   (Statistics): the average of the per-weekday targets.
 *
 * Goals' save stores the weekly peak in `max`/`min` even for per-weekday
 * goals (#203 upstream), so readers must not use `max ?? min` directly.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the stored keys */

/** One entry of the `goals` setting, keyed by nutrient (`calories`, `protein`, ...) */
export interface GoalEntry {
  min?: number | null;
  max?: number | null;
  /** Minimum goal ("at least"), as opposed to a maximum */
  isMin?: boolean;
  /** Macro goals: the value is a percentage of the calorie goal, not grams */
  isPercent?: boolean;
  /** `false`: one target per weekday in `days` (Sunday first) */
  sharedGoal?: boolean;
  days?: (number | null)[];
  [field: string]: unknown;
}

function sharedTarget(goal: GoalEntry): number | null {
  return goal.max ?? goal.min ?? null;
}

/** The target for the calendar date `date` (YYYY-MM-DD); `null` when there is none */
export function resolveGoalFor(
  goal: GoalEntry | null | undefined,
  date: string | null | undefined,
): number | null {
  if (!goal) return null;
  if (goal.sharedGoal !== false) return sharedTarget(goal);
  if (Array.isArray(goal.days) && goal.days.length === 7 && date) {
    // Local midnight, so getDay() is the weekday the user sees
    const day = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(day.getTime())) {
      const value = goal.days[day.getDay()];
      if (value != null) return value;
    }
  }
  return sharedTarget(goal);
}

/** One target for a range: per-weekday goals average their positive days */
export function resolveRangeGoal(
  goal: GoalEntry | null | undefined,
): number | null {
  if (!goal) return null;
  if (goal.sharedGoal !== false) return sharedTarget(goal);
  if (Array.isArray(goal.days) && goal.days.length > 0) {
    const values = goal.days
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length > 0) {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }
  return sharedTarget(goal);
}

/** A macro goal saved as percent of `calGoal`, in whole grams (`density` kcal/g) */
export function percentGoalToGrams(
  percent: unknown,
  calGoal: unknown,
  density: unknown,
): number | null {
  const p = Number(percent);
  const c = Number(calGoal);
  const d = Number(density);
  if (!Number.isFinite(p) || !Number.isFinite(c) || !(d > 0)) return null;
  return Math.round((c * p) / 100 / d);
}

/**
 * Grams as a percentage of `calGoal`, with the fewest decimals (0 to 2) that
 * convert back to the same whole grams, so toggling never drifts the target
 */
export function gramsGoalToPercent(
  grams: unknown,
  calGoal: unknown,
  density: unknown,
): number | null {
  const g = Number(grams);
  const c = Number(calGoal);
  const d = Number(density);
  if (!Number.isFinite(g) || !(c > 0) || !(d > 0)) return null;
  const exact = ((g * d) / c) * 100;
  const wanted = Math.round(g);
  for (const places of [0, 1, 2]) {
    const factor = 10 ** places;
    const percent = Math.round(exact * factor) / factor;
    if (percentGoalToGrams(percent, c, d) === wanted) return percent;
  }
  return Math.round(exact * 100) / 100;
}

/** A macro goal's target in grams, whether saved as grams or as percent */
export function macroGoalGrams(
  goal: GoalEntry | null | undefined,
  calGoal: number,
  density: number | undefined,
): number | null {
  const raw = goal?.max ?? goal?.min ?? null;
  if (raw == null || !goal?.isPercent || !density) return raw;
  return percentGoalToGrams(raw, calGoal, density) ?? raw;
}
