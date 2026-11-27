/** Reading what a model passes: anything may be missing or of another type */
import { localDateStr } from "../lib/dates";
import { NUTRIMENTS, round1, type NutritionValues } from "../lib/nutrition";

export type Args = Record<string, unknown>;

export function textArg(value: unknown, maxLength?: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return maxLength === undefined ? text : text.slice(0, maxLength);
}

export function positiveArg(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** A whole, non-negative number; 0 for anything else */
export function wholeArg(value: unknown): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

/** `YYYY-MM-DD`, else today */
export function dateArg(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : localDateStr();
}

/** A meal slot of the user's list; without one the fourth (or last) meal */
export function mealSlotArg(value: unknown, mealCount: number): number {
  const last = Math.max(0, mealCount - 1);
  const number = value == null ? NaN : Math.round(Number(value));
  if (!Number.isFinite(number)) return Math.min(3, last);
  return Math.max(0, Math.min(last, number));
}

/**
 * Only known nutriment ids with non-negative numbers, one decimal; null
 * without positive calories
 */
export function nutritionArg(value: unknown): NutritionValues | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (positiveArg(source.calories) === null) return null;
  const known = new Set(NUTRIMENTS.map((nutrient) => nutrient.id));
  const clean: NutritionValues = {};
  for (const [id, raw] of Object.entries(source)) {
    if (!known.has(id)) continue;
    const number = Number(raw);
    if (Number.isFinite(number) && number >= 0) clean[id] = round1(number);
  }
  return clean;
}

export function errorText(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
