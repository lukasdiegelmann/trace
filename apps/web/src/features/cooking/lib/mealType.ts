import type { MealType } from "./cookDiary";

/** The meal a new cook entry starts with (CookLogDialog.svelte) */
export function mealTypeAt(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  return hour < 21 ? "dinner" : "snack";
}
