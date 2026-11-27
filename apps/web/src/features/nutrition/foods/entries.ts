/**
 * One shape for everything the food list shows, whether it is the user's own,
 * shared by others or a hit from an outside source.
 */
import type { FoodRow, MealRow } from "../api";
import { mealTotals } from "../lib/mealForm";
import type { CooktraceRecipeSummary } from "../lib/sources/cooktrace";
import type { MealieRecipeSummary } from "../lib/sources/mealie";
import { externalFoodKey, type ExternalFood } from "../lib/sources/types";

export type Tab = "foods" | "meals" | "recipes";
export const TABS: readonly Tab[] = ["foods", "meals", "recipes"];

export type OutsideSource =
  "off" | "usda" | "mealie" | "cooktrace" | "cooktracePantry";
export type SourceId = "local" | "shared" | "all" | OutsideSource;

export type Entry =
  | { kind: "food"; key: string; row: FoodRow; isShared: boolean }
  | { kind: "meal"; key: string; row: MealRow; isShared: boolean }
  | { kind: "external"; key: string; food: ExternalFood }
  | { kind: "mealie"; key: string; recipe: MealieRecipeSummary }
  | { kind: "ctRecipe"; key: string; recipe: CooktraceRecipeSummary };

export const foodEntry = (row: FoodRow, isShared = false): Entry => ({
  kind: "food",
  key: `${isShared ? "shared-" : ""}food-${row.id}`,
  row,
  isShared,
});

export const mealEntry = (row: MealRow, isShared = false): Entry => ({
  kind: "meal",
  key: `${isShared ? "shared-" : ""}meal-${row.id}`,
  row,
  isShared,
});

export const externalEntry = (food: ExternalFood): Entry => ({
  kind: "external",
  // USDA and OFF reuse barcodes, so the name is part of the key
  key: `${food.source}-${externalFoodKey(food)}-${food.name}`,
  food,
});

export const mealieEntry = (recipe: MealieRecipeSummary): Entry => ({
  kind: "mealie",
  key: `mealie-${recipe.id || recipe.slug}`,
  recipe,
});

export const ctRecipeEntry = (recipe: CooktraceRecipeSummary): Entry => ({
  kind: "ctRecipe",
  key: `cooktrace-${recipe.id}`,
  recipe,
});

export function entryName(entry: Entry): string {
  switch (entry.kind) {
    case "food":
    case "meal":
      return entry.row.name;
    case "external":
      return entry.food.name;
    default:
      return entry.recipe.name;
  }
}

/** The user's own rows: what can be edited, deleted and selected to manage */
export function isOwn(entry: Entry): boolean {
  return (entry.kind === "food" || entry.kind === "meal") && !entry.isShared;
}

/** What a meal or recipe holds in kcal: from its ingredients, else as stored */
export function mealKcal(meal: MealRow): number {
  const fromItems = mealTotals(meal.items).calories || 0;
  return fromItems > 0 && !meal.is_recipe
    ? fromItems
    : (meal.nutrition.calories ?? fromItems);
}

export function mealGrams(meal: MealRow): number {
  return meal.items.reduce(
    (sum, item) => sum + (item.portion || 0) * (item.quantity ?? 1),
    0,
  );
}
