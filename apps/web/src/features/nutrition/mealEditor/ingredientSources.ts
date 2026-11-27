import type { FoodRow, MealItem, MealRow } from "../api";
import type { IngredientSource } from "../lib/mealForm";
import type { Amount, Loggable } from "../lib/pickItems";
import { parseAltUnits } from "../lib/units";

/** A saved food, meal or recipe as an ingredient: the whole row, snapshotted */
export function ingredientSourceOf(row: FoodRow | MealRow): IngredientSource {
  return row;
}

/** What the amount dialog needs to preview an ingredient */
export function loggableSource(source: IngredientSource): Loggable {
  const row = source as IngredientSource & {
    id?: number;
    brand?: string | null;
    notes?: string | null;
    is_recipe?: unknown;
  };
  return {
    id: row.id ?? 0,
    name: row.name,
    brand: row.brand,
    portion: row.portion,
    unit: row.unit,
    nutrition: { ...row.nutrition },
    nutrition_basis: row.nutrition_basis,
    density_g_ml: row.density_g_ml,
    alt_units: parseAltUnits(row.alt_units),
    img_url: row.img_url ?? row.imgUrl,
    isRecipe: Boolean(row.is_recipe),
  };
}

/** An ingredient in the list: its nutrition is for its whole amount */
export function loggableIngredient(item: MealItem): Loggable {
  return loggableSource(item);
}

export function amountOfIngredient(item: MealItem): Amount {
  return {
    portion: item.portion || 100,
    unit: item.unit || "g",
    quantity: item.quantity || 1,
  };
}
