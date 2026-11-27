/**
 * NutriTrace's import from CookTrace: CookTrace.mapRecipe
 * (src/lib/cooktraceApi.js) and the bulk import of
 * routes/settings/ConnectedServices.svelte.
 */
import { deriveSodiumSalt } from "./nutritionCalc";

type Raw = Record<string, unknown>;

export interface MealToCreate {
  name: string;
  img_url: string;
  items: Raw[];
  nutrition: Record<string, number>;
  servings: number;
  portion: number;
  unit: string;
  is_recipe: 1;
  source_app: "cooktrace";
  source_external_id: string;
  source_url: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mapIngredient(raw: Raw): Raw {
  return {
    name: text(raw.name).slice(0, 200),
    brand: text(raw.brand).slice(0, 120),
    portion: finite(raw.portion, 1),
    // No unit stays no unit: "4 egg yolks" must not become "4 g".
    unit: text(raw.unit).slice(0, 16),
    quantity: finite(raw.quantity, 1),
    nutrition:
      raw.nutrition && typeof raw.nutrition === "object"
        ? deriveSodiumSalt(raw.nutrition as Raw)
        : {},
    ...(raw.barcode ? { barcode: text(raw.barcode) } : {}),
    ...(raw.img_url ? { imgUrl: text(raw.img_url) } : {}),
  };
}

const GRAMS_PER: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/** Only weights count: a teaspoon is not a gram. 100 when nothing weighs */
export function totalGrams(items: readonly Raw[]): number {
  const total = items.reduce((sum, item) => {
    const factor = GRAMS_PER[text(item.unit).toLowerCase()] ?? 0;
    return sum + finite(item.portion, 0) * factor;
  }, 0);
  return Math.round(total) || 100;
}

/**
 * A CookTrace recipe as a NutriTrace recipe: CookTrace stores nutrition per
 * serving, and so does a saved NutriTrace recipe.
 */
export function mapRecipe(recipe: Raw): MealToCreate {
  const items = Array.isArray(recipe.items)
    ? (recipe.items as Raw[]).map(mapIngredient)
    : [];
  const yields = Math.max(1, finite(recipe.servings, 1) || 1);
  const perServing =
    recipe.nutrition && typeof recipe.nutrition === "object"
      ? deriveSodiumSalt(recipe.nutrition as Raw)
      : {};
  const nutrition = Object.fromEntries(
    Object.entries(perServing)
      .filter(([key]) => key !== "_derived")
      .map(([key, value]) => [key, parseFloat(String(value)) || 0]),
  );
  return {
    name: text(recipe.name) || "Recipe",
    img_url: text(recipe.img_url),
    items,
    nutrition,
    servings: yields,
    portion: totalGrams(items) / yields,
    unit: text(recipe.unit) || "g",
    is_recipe: 1,
    source_app: "cooktrace",
    source_external_id: `recipe:${text(recipe.id)}`,
    source_url: text(recipe.source_url) || null,
  };
}

export interface BulkCount {
  imported: number;
  updated: number;
  skipped: number;
  /** A food whose barcode was in the library already: left as it was */
  collided: number;
  firstError: string | null;
}

export function emptyCount(): BulkCount {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    collided: 0,
    firstError: null,
  };
}
