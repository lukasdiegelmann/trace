/**
 * The MealEditor's logic (meals and recipes), ported from
 * nutritrace/src/routes/MealEditor.svelte, Foods.svelte (clone) and
 * lib/stale-ingredients.js. An ingredient is a snapshot whose nutrition is
 * for its whole amount, so its quantity is 1.
 */

import type { MealItem, MealRow, MealWrite, NutritionMap } from "../api";
import { parseDecimal, parsePositive } from "./decimal";
import { numberText } from "./foodForm";
import {
  calculate,
  round1,
  scaleNutrition,
  sumNutrition,
  type NutritionValues,
} from "./nutrition";
import { mapCooktraceRecipe, type CooktraceRecipe } from "./sources/cooktrace";
import type { MealPrefill } from "./sources/types";
import { parseAltUnits, scaleFactor, unitToGrams } from "./units";

// ── Ingredients ─────────────────────────────────────────────────────────

/** A food, meal or recipe row (save outside picks to the library first) */
export interface IngredientSource {
  name: string;
  portion?: number | null;
  unit?: string | null;
  quantity?: number | null;
  nutrition?: NutritionMap | null;
  img_url?: string | null;
  imgUrl?: string | null;
  nutrition_basis?: "g" | "ml" | null;
  density_g_ml?: number | null;
  alt_units?: unknown;
}

/** What the portion sheet's inputs hold */
export interface IngredientAmount {
  portion: number | string;
  unit: string;
  quantity: number | string;
}

/** The portion sheet's starting values for a new ingredient */
export function defaultIngredientAmount(
  source: IngredientSource,
): IngredientAmount {
  return {
    portion: source.portion || 100,
    unit: source.unit || "g",
    quantity: source.quantity || 1,
  };
}

/** The sheet's starting values for an ingredient already in the list */
export function ingredientAmountOf(item: MealItem): IngredientAmount {
  return {
    portion: item.portion || 100,
    unit: item.unit,
    quantity: item.quantity || 1,
  };
}

/** The sheet's "total amount" line */
export function ingredientTotal(amount: IngredientAmount): number {
  return round1(
    (parseDecimal(amount.portion) || 100) *
      (parseDecimal(amount.quantity) || 1),
  );
}

/** Numbers times `factor`; `_derived` stays as it is */
function scaleIngredientNutrition(
  nutrition: NutritionMap | null | undefined,
  factor: number,
): NutritionMap {
  const derived = (nutrition as { _derived?: unknown } | null | undefined)
    ?._derived;
  const out: Record<string, unknown> = scaleNutrition(nutrition, factor);
  if (derived) out._derived = derived;
  return out as NutritionMap;
}

export function ingredientFrom(
  source: IngredientSource,
  amount: IngredientAmount,
): MealItem {
  const originalPortion = source.portion || 100;
  const originalUnit = source.unit || "g";
  const portion = parseDecimal(amount.portion) || originalPortion;
  const quantity = parseDecimal(amount.quantity) || 1;
  const unit = amount.unit || originalUnit;
  const factor =
    scaleFactor(originalPortion, originalUnit, portion, unit, source) *
    quantity;
  const snapshot: Record<string, unknown> = { ...source };
  const image = source.imgUrl || source.img_url;
  delete snapshot.img_url;
  delete snapshot._shared_by;
  delete snapshot._specific_users;
  return {
    ...snapshot,
    name: source.name,
    ...(image ? { imgUrl: image } : {}),
    portion: portion * quantity,
    unit,
    quantity: 1,
    nutrition: scaleIngredientNutrition(source.nutrition, factor),
  };
}

/** An ingredient at a new amount, scaled from what it holds now */
export function changeIngredientAmount(
  item: MealItem,
  amount: IngredientAmount,
): MealItem {
  const oldPortion = (item.portion || 100) * (item.quantity || 1);
  const total =
    (parseDecimal(amount.portion) || 100) *
    (parseDecimal(amount.quantity) || 1);
  const factor = scaleFactor(oldPortion, item.unit, total, amount.unit, item);
  return {
    ...item,
    portion: total,
    unit: amount.unit,
    quantity: 1,
    nutrition: scaleIngredientNutrition(item.nutrition, factor),
  };
}

/** Moved from one position to another (drag); unchanged if out of range */
export function reorderIngredients<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) {
    return next;
  }
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** Up (-1) or down (1) */
export function moveIngredient<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  return reorderIngredients(items, index, index + direction);
}

export function mealTotals(items: readonly MealItem[]): NutritionValues {
  return sumNutrition(items.map(calculate));
}

// ── Recipe weight ───────────────────────────────────────────────────────

/** One unit of an ingredient in grams (its own serving units first) */
function itemUnitGrams(item: MealItem): number | null {
  const unit = item.unit.toLowerCase();
  const own = parseAltUnits(item.alt_units)?.find(
    (row) => row.abbr.toLowerCase() === unit,
  );
  // Stored JSON: the weight may be text
  return parsePositive(own?.grams) ?? unitToGrams(unit);
}

/**
 * The ingredients' weight in `unit` (1 ml = 1 g). Ingredients in a unit
 * without a weight ("piece", "serving", none) don't count; null when `unit`
 * itself has none.
 */
export function recipeTotalWeight(
  items: readonly MealItem[],
  unit: string,
): number | null {
  const target = unitToGrams(unit);
  if (target === null) return null;
  let grams = 0;
  for (const item of items) {
    const each = itemUnitGrams(item);
    if (each !== null) {
      grams += (parseDecimal(item.portion) || 0) * (item.quantity || 1) * each;
    }
  }
  return grams / target;
}

function roundWeight(weight: number, unit: string): number {
  return ["g", "mg", "ml"].includes(unit.toLowerCase())
    ? Math.round(weight)
    : Math.round(weight * 100) / 100;
}

// ── Form ────────────────────────────────────────────────────────────────

export interface MealFormState {
  id: number | null;
  isRecipe: boolean;
  name: string;
  notes: string;
  imgUrl: string;
  items: MealItem[];
  /** A recipe's total weight as typed */
  recipeAmount: string;
  recipeUnit: string;
  /** Servings as typed; "" for a recipe that never had any */
  recipeYields: string;
  isFavorite: boolean;
  /**
   * Whole-recipe totals of an imported recipe, which know densities the
   * ingredients don't; dropped as soon as the ingredients change
   */
  sourceNutrition: NutritionMap | null;
  sourceApp: string | null;
  sourceExternalId: string | null;
  sourceUrl: string | null;
  importWarnings: string[];
  updatedAt: string | null;
  sharedBy: string | null;
}

export function emptyMealForm(isRecipe: boolean): MealFormState {
  return {
    id: null,
    isRecipe,
    name: "",
    notes: "",
    imgUrl: "",
    items: [],
    recipeAmount: "",
    recipeUnit: "g",
    recipeYields: "1",
    isFavorite: false,
    sourceNutrition: null,
    sourceApp: null,
    sourceExternalId: null,
    sourceUrl: null,
    importWarnings: [],
    updatedAt: null,
    sharedBy: null,
  };
}

export function mealFormFromRow(
  row: MealRow,
  isRecipe: boolean = row.is_recipe,
): MealFormState {
  const servings = row.servings;
  const effective = servings === null ? 1 : Math.max(1, Math.trunc(servings));
  return {
    ...emptyMealForm(isRecipe),
    id: row.id,
    name: row.name,
    notes: row.notes ?? "",
    imgUrl: row.img_url ?? "",
    items: row.items,
    recipeAmount:
      isRecipe && row.portion ? numberText(row.portion * effective) : "",
    recipeUnit: row.unit || "g",
    recipeYields: servings === null ? "" : String(effective),
    isFavorite: Boolean(row.favorite),
    // Stored per serving; upstream divided it by the servings on every save
    sourceNutrition:
      isRecipe && row.source_app
        ? scaleNutrition(row.nutrition, effective)
        : null,
    sourceApp: row.source_app,
    sourceExternalId: row.source_external_id,
    sourceUrl: row.source_url,
    importWarnings: row.import_warnings ?? [],
    updatedAt: row.updated_at,
    sharedBy: row._shared_by ?? null,
  };
}

/** A CookTrace pick, not saved yet */
export function mealFormFromPrefill(prefill: MealPrefill): MealFormState {
  const servings = Math.max(1, Math.trunc(prefill.servings) || 1);
  return {
    ...emptyMealForm(true),
    name: prefill.name,
    imgUrl: prefill.imgUrl,
    items: prefill.items,
    recipeAmount: prefill.portion ? numberText(prefill.portion * servings) : "",
    recipeUnit: prefill.unit || "g",
    recipeYields: String(servings),
    sourceNutrition: prefill.nutrition,
    sourceApp: prefill.source_app,
    sourceExternalId: prefill.source_external_id,
    sourceUrl: prefill.source_url,
  };
}

/**
 * A recipe's total weight follows its ingredients, in the chosen unit. It
 * stays as typed when that unit has no weight.
 */
export function autoUpdateRecipeAmount(form: MealFormState): MealFormState {
  if (!form.isRecipe) return form;
  const weight = recipeTotalWeight(form.items, form.recipeUnit);
  if (weight === null) return form;
  const rounded = roundWeight(weight, form.recipeUnit);
  return { ...form, recipeAmount: rounded > 0 ? String(rounded) : "" };
}

function withItems(form: MealFormState, items: MealItem[]): MealFormState {
  return autoUpdateRecipeAmount({ ...form, items, sourceNutrition: null });
}

export function addIngredients(
  form: MealFormState,
  items: readonly MealItem[],
): MealFormState {
  return withItems(form, [...form.items, ...items]);
}

export function removeIngredient(
  form: MealFormState,
  index: number,
): MealFormState {
  return withItems(
    form,
    form.items.filter((_, i) => i !== index),
  );
}

export function setIngredientAmount(
  form: MealFormState,
  index: number,
  amount: IngredientAmount,
): MealFormState {
  return withItems(
    form,
    form.items.map((item, i) =>
      i === index ? changeIngredientAmount(item, amount) : item,
    ),
  );
}

/** The yields field: "" (or no number) counts as 1 serving, but is "unset" */
export function recipeServings(text: string): {
  servings: number;
  isExplicit: boolean;
} {
  const parsed = parseInt(text, 10);
  return Number.isNaN(parsed)
    ? { servings: 1, isExplicit: false }
    : { servings: Math.max(1, parsed), isExplicit: true };
}

export interface PerServing {
  /** In `unit`, one decimal */
  amount: number;
  unit: string;
  kcal: number;
}

/** Shown once there is a total weight and at least one serving */
export function perServing(form: MealFormState): PerServing | null {
  const total = parsePositive(form.recipeAmount);
  const yields = parseInt(form.recipeYields, 10);
  if (total === null || !(yields >= 1)) return null;
  return {
    amount: round1(total / yields),
    unit: form.recipeUnit,
    kcal: (mealTotals(form.items).calories || 0) / yields,
  };
}

export type MealFormError = "nameRequired" | "noIngredients";

export function validateMealForm(form: MealFormState): MealFormError[] {
  const errors: MealFormError[] = [];
  if (!form.name.trim()) errors.push("nameRequired");
  if (form.items.length === 0) errors.push("noIngredients");
  return errors;
}

/**
 * For `mealsApi.create` or `update`. A meal stores its totals; a recipe
 * stores weight and nutrition per serving.
 */
export function mealFormToWrite(form: MealFormState): MealWrite {
  const isNew = form.id === null;
  const write: MealWrite = {
    name: form.name,
    notes: form.notes,
    img_url: form.imgUrl || null,
    items: form.items,
    is_recipe: form.isRecipe,
    nutrition: mealTotals(form.items),
    ...(isNew ? {} : { favorite: form.isFavorite }),
    ...(isNew && form.sourceApp ? { source_app: form.sourceApp } : {}),
    ...(isNew && form.sourceExternalId
      ? { source_external_id: form.sourceExternalId }
      : {}),
    ...(isNew && form.sourceUrl ? { source_url: form.sourceUrl } : {}),
    ...(isNew && form.importWarnings.length > 0
      ? { import_warnings: form.importWarnings }
      : {}),
  };
  if (!form.isRecipe) return write;
  const weighed = recipeTotalWeight(form.items, form.recipeUnit);
  const total =
    parsePositive(form.recipeAmount) ??
    (roundWeight(weighed ?? 0, form.recipeUnit) || 100);
  const { servings, isExplicit } = recipeServings(form.recipeYields);
  const rollup = form.sourceNutrition;
  const hasRollup =
    !!form.sourceApp &&
    !!rollup &&
    Object.values(rollup).some((value) => Number(value) > 0);
  return {
    ...write,
    portion: total / servings,
    unit: form.recipeUnit,
    servings: isExplicit ? servings : null,
    nutrition: scaleNutrition(
      hasRollup ? rollup : write.nutrition,
      1 / servings,
    ),
  };
}

/** The CookTrace "refresh" banner; nothing is saved yet */
export function applyCooktraceRefresh(
  form: MealFormState,
  recipe: CooktraceRecipe,
): MealFormState {
  const fresh = mapCooktraceRecipe(recipe);
  return {
    ...form,
    name: fresh.name || form.name,
    items: fresh.items,
    imgUrl: fresh.imgUrl || form.imgUrl,
    recipeYields: fresh.servings ? String(fresh.servings) : form.recipeYields,
    sourceNutrition: fresh.nutrition,
    sourceUrl: fresh.source_url ?? form.sourceUrl,
  };
}

/**
 * A duplicate of a saved meal or recipe. Without the source ids: with them
 * the server would write the copy over the original.
 */
export function cloneMealWrite(row: MealRow, name: string): MealWrite {
  return {
    name,
    nutrition: row.nutrition,
    items: row.items,
    img_url: row.img_url,
    notes: row.notes,
    is_recipe: row.is_recipe,
    portion: row.portion,
    unit: row.unit,
    servings: row.servings,
  };
}

// ── Stale ingredients ───────────────────────────────────────────────────

/** A saved ingredient or a library row, with whatever ids it has */
export interface CatalogueEntry {
  id?: unknown;
  server_id?: unknown;
  food_server_id?: unknown;
  name?: string;
}

function idsOf(entry: CatalogueEntry): number[] {
  return [entry.id, entry.server_id, entry.food_server_id].filter(
    (id): id is number => typeof id === "number",
  );
}

/**
 * Names of ingredients whose food is gone from the library, in meal order.
 * Nothing without a loaded library, and never for ingredients without an id.
 * Pass the foods, meals and recipes lists.
 */
export function staleIngredientNames(
  items: readonly CatalogueEntry[] | null | undefined,
  catalogues: readonly (readonly CatalogueEntry[] | null | undefined)[],
): string[] {
  const rows = catalogues.flatMap((list) => list ?? []);
  if (!items || rows.length === 0) return [];
  const known = new Set(rows.flatMap(idsOf));
  return items
    .filter((item) => {
      const ids = idsOf(item);
      return ids.length > 0 && !ids.some((id) => known.has(id));
    })
    .map((item) => item.name ?? "")
    .filter(Boolean);
}
