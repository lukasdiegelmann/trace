/**
 * What picking a food, recipe or meal puts into the diary, ported from
 * Foods.svelte (_addFoodToDiary, confirmQtyPrompt, _expandMealToDiary).
 */
import type { DiaryItem, FoodRow, MealItem, MealRow } from "../api";
import { newDiaryItem, type DiaryItemSource } from "./diary";
import { scaleNutrition } from "./nutrition";
import { scaleFactor, type ScalableFood } from "./units";

/** What the quantity sheet needs of anything that can be logged */
export interface Loggable extends ScalableFood {
  id: number;
  name: string;
  brand?: string | null;
  notes?: string | null;
  portion?: number | string | null;
  unit?: string | null;
  nutrition: Record<string, unknown>;
  img_url?: string | null;
  isRecipe: boolean;
}

export function loggableFood(row: FoodRow): Loggable {
  return { ...row, isRecipe: false };
}

/** A recipe is logged as one entry, by the serving */
export function loggableRecipe(row: MealRow): Loggable {
  return { ...row, isRecipe: true };
}

export interface Amount {
  portion: number;
  unit: string;
  /** Servings of that portion */
  quantity: number;
}

export function storedAmount(food: Loggable): Amount {
  return {
    portion: Number(food.portion) || 100,
    unit: food.unit || "g",
    quantity: 1,
  };
}

/**
 * The entry for `amount` of a food: its nutrition scaled to the chosen
 * portion, the servings as `quantity`.
 */
export function diarySource(food: Loggable, amount: Amount): DiaryItemSource {
  const stored = storedAmount(food);
  const factor = scaleFactor(
    stored.portion,
    stored.unit,
    amount.portion,
    amount.unit,
    food,
  );
  return {
    id: food.id,
    name: food.name,
    brand: food.brand ?? "",
    notes: food.notes ?? "",
    imgUrl: food.img_url ?? "",
    is_recipe: food.isRecipe ? 1 : 0,
    portion: amount.portion,
    unit: amount.unit,
    quantity: amount.quantity,
    nutrition: scaleNutrition(food.nutrition, factor),
  };
}

/** The diary item of one ingredient, as the meal stores it */
function ingredientSource(ingredient: MealItem): DiaryItemSource {
  return {
    id: ingredient.id,
    name: ingredient.name,
    brand: ingredient.brand ?? "",
    imgUrl: ingredient.imgUrl ?? "",
    is_recipe: ingredient.is_recipe ? 1 : 0,
    portion: ingredient.portion || 100,
    unit: ingredient.unit || "g",
    quantity: ingredient.quantity || 1,
    nutrition: scaleNutrition(ingredient.nutrition, 1),
  };
}

/** A meal is logged as its ingredients, one entry each */
export function mealDiaryItems(
  meal: MealRow,
  slot: number,
  now: Date = new Date(),
): DiaryItem[] {
  return meal.items.map((ingredient) =>
    newDiaryItem(ingredientSource(ingredient), slot, now),
  );
}
