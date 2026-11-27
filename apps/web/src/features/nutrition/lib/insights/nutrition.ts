/**
 * The part of nutritrace/src/lib/nutrition.js that Statistics needs: the
 * nutriment list and the per-item totals. Kept here (not shared with #3)
 * so the two parity threads don't edit the same file; fold together once
 * both have landed.
 */

export interface Nutriment {
  id: string;
  unit: string;
  /** Shown in Statistics (the original's `default: true`) */
  isDefault: boolean;
}

/** nutrition.js NUTRIMENTS, in label order */
export const NUTRIMENTS: readonly Nutriment[] = [
  { id: "calories", unit: "kcal", isDefault: true },
  { id: "kilojoules", unit: "kJ", isDefault: false },
  { id: "fat", unit: "g", isDefault: true },
  { id: "saturated-fat", unit: "g", isDefault: true },
  { id: "trans-fat", unit: "g", isDefault: false },
  { id: "polyunsaturated-fat", unit: "g", isDefault: false },
  { id: "monounsaturated-fat", unit: "g", isDefault: false },
  { id: "cholesterol", unit: "mg", isDefault: false },
  { id: "sodium", unit: "mg", isDefault: true },
  { id: "salt", unit: "g", isDefault: false },
  { id: "carbohydrates", unit: "g", isDefault: true },
  { id: "fiber", unit: "g", isDefault: true },
  { id: "sugars", unit: "g", isDefault: true },
  { id: "added-sugars", unit: "g", isDefault: true },
  { id: "proteins", unit: "g", isDefault: true },
  { id: "vitamin-d", unit: "mcg", isDefault: true },
  { id: "calcium", unit: "mg", isDefault: true },
  { id: "iron", unit: "mg", isDefault: true },
  { id: "potassium", unit: "mg", isDefault: true },
  { id: "vitamin-a", unit: "mcg", isDefault: false },
  { id: "vitamin-c", unit: "mg", isDefault: false },
  { id: "vitamin-e", unit: "mg", isDefault: false },
  { id: "vitamin-k", unit: "mcg", isDefault: false },
  { id: "b1", unit: "mg", isDefault: false },
  { id: "b2", unit: "mg", isDefault: false },
  { id: "b3", unit: "mg", isDefault: false },
  { id: "b6", unit: "mg", isDefault: false },
  { id: "b9", unit: "mcg", isDefault: false },
  { id: "b12", unit: "mcg", isDefault: false },
  { id: "magnesium", unit: "mg", isDefault: false },
  { id: "zinc", unit: "mg", isDefault: false },
  { id: "phosphorus", unit: "mg", isDefault: false },
  { id: "caffeine", unit: "mg", isDefault: false },
  { id: "alcohol", unit: "g", isDefault: false },
];

export function isNutriment(id: string): boolean {
  return NUTRIMENTS.some((n) => n.id === id);
}

export type NutritionTotals = Record<string, number>;

/** A diary item as the backend stores it (only what the totals read) */
export interface DiaryItemLike {
  quantity?: number | string | null;
  nutrition?: Record<string, unknown> | null;
  calories_kcal?: number | string | null;
  _splitItems?: DiaryItemLike[] | null;
  [field: string]: unknown;
}

/** nutrition.js SODIUM_MG_PER_SALT_G: the EU labelling factor */
export const SODIUM_MG_PER_SALT_G = 400;

function toNumber(value: unknown): number {
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function isPresent(value: unknown): boolean {
  return value != null && value !== "" && Number(value) > 0;
}

/** nutrition.js deriveSodiumSalt, on a plain totals object */
export function deriveSodiumSalt(totals: NutritionTotals): NutritionTotals {
  const hasSodium = isPresent(totals.sodium);
  const hasSalt = isPresent(totals.salt);
  if (hasSodium === hasSalt) return totals;
  if (hasSodium) {
    totals.salt =
      Math.round((totals.sodium / SODIUM_MG_PER_SALT_G) * 1000) / 1000;
  } else {
    totals.sodium = Math.round(totals.salt * SODIUM_MG_PER_SALT_G * 10) / 10;
  }
  return totals;
}

/** nutrition.js Nutrition.sum */
export function sumNutrition(
  list: readonly (NutritionTotals | null | undefined)[],
): NutritionTotals {
  const result: NutritionTotals = {};
  for (const totals of list) {
    if (!totals) continue;
    for (const [key, value] of Object.entries(totals)) {
      result[key] = (result[key] ?? 0) + toNumber(value);
    }
  }
  return result;
}

/** nutrition.js Nutrition.calculate: one item's nutrition times its servings */
export function calculateItem(
  item: DiaryItemLike | null | undefined,
): NutritionTotals {
  if (!item) return {};
  if (Array.isArray(item._splitItems) && item._splitItems.length > 0) {
    return sumNutrition(item._splitItems.map((child) => calculateItem(child)));
  }
  const factor = toNumber(item.quantity) || 1;
  const result: NutritionTotals = {};
  const nested = item.nutrition;
  if (nested && typeof nested === "object" && Object.keys(nested).length > 0) {
    for (const [key, value] of Object.entries(nested)) {
      if (key === "_derived") continue;
      result[key] = toNumber(value) * factor;
    }
  } else {
    for (const n of NUTRIMENTS) {
      const value = item[n.id];
      if (isFilled(value)) {
        result[n.id] = toNumber(value) * factor;
      }
    }
    if (item.calories_kcal !== undefined && !("calories" in result)) {
      result.calories = toNumber(item.calories_kcal) * factor;
    }
  }
  return deriveSodiumSalt(result);
}

export function kcalToKj(kcal: number): number {
  return toNumber(kcal) * 4.184;
}

/** A stored value that holds something */
function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export type EnergyUnit = "kcal" | "kJ";

/** nutrition.js Nutrition.displayEnergy: kcal stored, shown in the user's unit */
export function displayEnergy(
  kcal: number,
  unit: string,
): { value: number; unit: EnergyUnit } {
  const n = toNumber(kcal);
  if (unit === "kJ") return { value: Math.round(n * 4.184), unit: "kJ" };
  return { value: Math.round(n), unit: "kcal" };
}
