/**
 * Unit conversion and a recipe's nutrition from its pantry links, ported
 * from cooktrace/src/lib/recipe-nutrition.js.
 */
import { COMMON_DENSITIES } from "./densities";
import { parseQty } from "./qty";

const VOLUME_TO_ML: Partial<Record<string, number>> = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  tsp: 4.929,
  tbsp: 14.787,
  "fl oz": 29.574,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
  gal: 3785.411,
};
const WEIGHT_TO_G: Partial<Record<string, number>> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};
const ML_PER_CUP = 236.588;

export const VOLUME_TARGETS = ["tsp", "tbsp", "fl oz", "cup", "ml", "l"];
export const WEIGHT_TARGETS = ["g", "kg", "oz", "lb"];

export type UnitFamily = "volume" | "weight" | "count";

const normalise = (unit: string | null | undefined) =>
  (unit ?? "").toLowerCase().trim();

export function unitFamily(unit: string | null | undefined): UnitFamily | null {
  if (!unit) return null;
  const key = normalise(unit);
  if (VOLUME_TO_ML[key] !== undefined) return "volume";
  if (WEIGHT_TO_G[key] !== undefined) return "weight";
  return "count";
}

export function convertWithinFamily(
  qty: number,
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!Number.isFinite(qty)) return null;
  const family = unitFamily(from);
  if (!family || family !== unitFamily(to)) return null;
  const a = normalise(from);
  const b = normalise(to);
  if (family === "volume") {
    return (qty * (VOLUME_TO_ML[a] ?? 0)) / (VOLUME_TO_ML[b] ?? 1);
  }
  if (family === "weight") {
    return (qty * (WEIGHT_TO_G[a] ?? 0)) / (WEIGHT_TO_G[b] ?? 1);
  }
  return a === b ? qty : null;
}

export function lookupCommonDensity(
  name: string | null | undefined,
): number | null {
  const text = normalise(name);
  if (!text) return null;
  const hit = COMMON_DENSITIES.find(([key]) => text.includes(key));
  return hit ? hit[1] : null;
}

/** Same family directly; volume and weight through grams per cup */
export function convertQty(
  qty: number,
  from: string | null | undefined,
  to: string | null | undefined,
  gPerCup?: number | null,
): number | null {
  if (!Number.isFinite(qty)) return null;
  const same = convertWithinFamily(qty, from, to);
  if (same !== null) return same;
  if (!gPerCup || !Number.isFinite(gPerCup) || gPerCup <= 0) return null;
  const a = normalise(from);
  const b = normalise(to);
  const fromFamily = unitFamily(from);
  const toFamily = unitFamily(to);
  const gramsPerMl = gPerCup / ML_PER_CUP;
  if (fromFamily === "volume" && toFamily === "weight") {
    return (qty * (VOLUME_TO_ML[a] ?? 0) * gramsPerMl) / (WEIGHT_TO_G[b] ?? 1);
  }
  if (fromFamily === "weight" && toFamily === "volume") {
    return (qty * (WEIGHT_TO_G[a] ?? 0)) / gramsPerMl / (VOLUME_TO_ML[b] ?? 1);
  }
  return null;
}

/** What the calculations read of a pantry row */
export interface NutritionPantryRow {
  id: number;
  name: string;
  g_per_cup?: number | null;
  serving_size?: number | string | null;
  serving_unit?: string | null;
  nutrition?: Record<string, unknown> | null;
  nutrition_source_variant_id?: number | null;
  generic_parent_id?: number | null;
}

export interface NutritionIngredient {
  qty?: string | null;
  unit?: string | null;
  name?: string | null;
  pantry_item_id?: number | null;
}

export interface NutritionGroup {
  items?: NutritionIngredient[];
}

export type PantryById = ReadonlyMap<number, NutritionPantryRow>;

/**
 * A generic pantry item may name one of its variants as the source of
 * its nutrition (issue #4 upstream).
 */
export function resolveNutritionSource(
  pantry: PantryById,
  id: number | null | undefined,
): NutritionPantryRow | null {
  if (id === null || id === undefined) return null;
  const own = pantry.get(id);
  if (!own) return null;
  const sourceId = own.nutrition_source_variant_id;
  if (sourceId === null || sourceId === undefined) return own;
  const source = pantry.get(sourceId);
  return source && source.generic_parent_id === own.id ? source : own;
}

export type SkipReason =
  | { code: "noNutrition" }
  | { code: "noQuantity" }
  | { code: "needsDensity" }
  | { code: "unitMismatch"; unit: string; servingUnit: string }
  | { code: "servingInvalid" };

export interface SkippedIngredient {
  name: string;
  reason: SkipReason;
}

export interface RecipeNutritionResult {
  /** Totals of the whole recipe */
  nutrition: Record<string, number>;
  used: number;
  skipped: SkippedIngredient[];
  total: number;
}

export function computeRecipeNutrition(
  groups: readonly NutritionGroup[],
  pantry: PantryById,
): RecipeNutritionResult {
  const totals: Record<string, number> = {};
  const skipped: SkippedIngredient[] = [];
  let used = 0;
  let total = 0;
  for (const group of groups) {
    for (const item of group.items ?? []) {
      total++;
      const name = item.name;
      if (!name) continue;
      const row = resolveNutritionSource(pantry, item.pantry_item_id);
      if (!row?.nutrition || !row.serving_size || !row.serving_unit) {
        skipped.push({ name, reason: { code: "noNutrition" } });
        continue;
      }
      const qty = parseQty(item.qty);
      if (qty === null || qty <= 0) {
        skipped.push({ name, reason: { code: "noQuantity" } });
        continue;
      }
      const converted = convertQty(
        qty,
        item.unit,
        row.serving_unit,
        row.g_per_cup,
      );
      if (converted === null) {
        const isCrossFamily =
          Boolean(item.unit) &&
          unitFamily(item.unit) !== unitFamily(row.serving_unit);
        skipped.push({
          name,
          reason:
            isCrossFamily && !row.g_per_cup
              ? { code: "needsDensity" }
              : {
                  code: "unitMismatch",
                  unit: item.unit ?? "",
                  servingUnit: row.serving_unit,
                },
        });
        continue;
      }
      const ratio = converted / Number(row.serving_size);
      if (!Number.isFinite(ratio) || ratio <= 0) {
        skipped.push({ name, reason: { code: "servingInvalid" } });
        continue;
      }
      for (const [key, value] of Object.entries(row.nutrition)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        totals[key] = (totals[key] ?? 0) + value * ratio;
      }
      used++;
    }
  }
  for (const key of Object.keys(totals)) {
    totals[key] = Math.round((totals[key] ?? 0) * 10) / 10;
  }
  return { nutrition: totals, used, skipped, total };
}

/**
 * Unlinked ingredients borrow the pantry row of exactly their name, for a
 * calculation only (nothing is saved on the recipe).
 */
export function linkByName(
  groups: readonly NutritionGroup[],
  rows: readonly { id: number; name: string }[],
): NutritionGroup[] {
  const ids = new Map(
    rows.map((row) => [row.name.toLowerCase().trim(), row.id]),
  );
  return groups.map((group) => ({
    items: (group.items ?? []).map((item) => ({
      ...item,
      pantry_item_id:
        item.pantry_item_id ?? ids.get((item.name ?? "").toLowerCase().trim()),
    })),
  }));
}

/** Totals as per-serving values, two decimals */
export function perServing(
  totals: Record<string, number>,
  servings: number | null | undefined,
): Record<string, number> {
  const divisor = servings && servings > 0 ? servings : 1;
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      Math.round((value / divisor) * 100) / 100,
    ]),
  );
}

/**
 * Grams per serving, for "Serving Size ~85g". `isComplete` only when
 * every ingredient with a quantity could be weighed.
 */
export function computeRecipeMass(
  recipe: { ingredients?: NutritionGroup[]; servings?: number | null },
  pantry: PantryById,
): { perServingG: number | null; isComplete: boolean } {
  let grams = 0;
  let isComplete = true;
  const add = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      isComplete = false;
      return;
    }
    grams += value;
  };
  for (const group of recipe.ingredients ?? []) {
    for (const item of group.items ?? []) {
      if (!item.name) continue;
      const qty = parseQty(item.qty);
      if (qty === null || qty <= 0) continue;
      const row = resolveNutritionSource(pantry, item.pantry_item_id);
      const family = unitFamily(item.unit);
      if (family === "weight") {
        add(qty * (WEIGHT_TO_G[normalise(item.unit)] ?? Number.NaN));
      } else if (family === "volume") {
        add(
          row?.g_per_cup
            ? convertQty(qty, item.unit, "g", row.g_per_cup)
            : null,
        );
      } else {
        // A count: the pantry serving says what one piece weighs.
        const size = Number(row?.serving_size);
        const unit = normalise(row?.serving_unit);
        let perItem: number | null = null;
        if (Number.isFinite(size) && size > 0) {
          if (WEIGHT_TO_G[unit] !== undefined) {
            perItem = size * (WEIGHT_TO_G[unit] ?? 0);
          } else if (VOLUME_TO_ML[unit] !== undefined && row?.g_per_cup) {
            perItem =
              size * (VOLUME_TO_ML[unit] ?? 0) * (row.g_per_cup / ML_PER_CUP);
          }
        }
        add(perItem === null ? null : qty * perItem);
      }
    }
  }
  if (grams === 0) return { perServingG: null, isComplete: false };
  const result = Math.round(grams / (recipe.servings || 1));
  return { perServingG: result > 0 ? result : null, isComplete };
}
