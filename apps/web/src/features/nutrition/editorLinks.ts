/** How the diary, the food list and the editors hand over to each other */
import type { MealPrefill, ExternalFood } from "./lib/sources/types";
import { isIsoDate, localDateStr } from "./lib/dates";

/** What the food list is picking for */
export interface PickContext {
  /** Meal slot */
  meal: number;
  date: string;
  /** uuid of the entry the pick replaces */
  replace: string | null;
}

export function pickFromSearch(params: URLSearchParams): PickContext | null {
  if (params.get("pick") !== "1") return null;
  const date = params.get("date");
  return {
    meal: Number(params.get("meal")) || 0,
    date: isIsoDate(date) ? date : localDateStr(),
    replace: params.get("replace"),
  };
}

export function diaryPath(date: string): string {
  return date === localDateStr() ? "/nutrition" : `/nutrition?date=${date}`;
}

/** Router state of `/nutrition/foods/edit[/:id]` */
export interface FoodEditorState {
  /** A hit from an outside source, not saved yet */
  prefill?: ExternalFood;
  /** A scanned code with no food behind it */
  barcode?: string;
  /** Saving also logs the food */
  pick?: PickContext;
}

/** Router state of `/nutrition/meals/edit[/:id]` */
export interface MealEditorState {
  prefill?: MealPrefill;
}
