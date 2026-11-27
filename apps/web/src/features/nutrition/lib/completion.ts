/** Closing days and meals (#207 upstream) */
import type { DiaryDay } from "../api";
import { itemsOfMeal } from "./diary";

/** Meal slots with nothing logged that aren't marked complete yet */
export function emptyUnmarkedMeals(day: DiaryDay, mealCount: number): number[] {
  return Array.from({ length: mealCount }, (_, index) => index).filter(
    (index) =>
      itemsOfMeal(day.items, index).length === 0 &&
      !day.completed_meals.includes(index),
  );
}

export function areAllMealsMarked(marks: number[], mealCount: number): boolean {
  return (
    mealCount > 0 &&
    Array.from({ length: mealCount }, (_, index) => index).every((index) =>
      marks.includes(index),
    )
  );
}
