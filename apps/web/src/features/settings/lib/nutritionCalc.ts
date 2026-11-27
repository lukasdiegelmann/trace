/** Ported from NutriTrace's src/lib/nutrition.js (Nutrition.calculate and co) */
import { NUTRIMENTS } from "./nutrimentCatalog";

export type NutritionValues = Partial<Record<string, number>>;

const SODIUM_MG_PER_SALT_G = 400;

function isPositive(value: unknown): boolean {
  return value != null && value !== "" && Number(value) > 0;
}

function toNumber(value: unknown): number {
  return parseFloat(String(value)) || 0;
}

/** Fills in whichever of sodium and salt is missing from the other */
export function deriveSodiumSalt(
  nutrition: Record<string, unknown>,
): Record<string, unknown> {
  const hasSodium = isPositive(nutrition.sodium);
  const hasSalt = isPositive(nutrition.salt);
  if (hasSodium === hasSalt) return nutrition;
  const derived = { ...((nutrition._derived as object | undefined) ?? {}) };
  if (hasSodium) {
    return {
      ...nutrition,
      salt:
        Math.round((Number(nutrition.sodium) / SODIUM_MG_PER_SALT_G) * 1000) /
        1000,
      _derived: { ...derived, salt: true, sodium: false },
    };
  }
  return {
    ...nutrition,
    sodium: Math.round(Number(nutrition.salt) * SODIUM_MG_PER_SALT_G * 10) / 10,
    _derived: { ...derived, sodium: true, salt: false },
  };
}

export interface DiaryItem {
  [field: string]: unknown;
  quantity?: unknown;
  nutrition?: Record<string, unknown> | null;
  _splitItems?: DiaryItem[];
}

export function sumNutrition(list: NutritionValues[]): NutritionValues {
  const result: NutritionValues = {};
  for (const values of list) {
    for (const [key, value] of Object.entries(values)) {
      result[key] = (result[key] ?? 0) + toNumber(value);
    }
  }
  return result;
}

/** One diary item's nutrition: per serving times the number of servings */
export function calculateNutrition(item: DiaryItem): NutritionValues {
  if (Array.isArray(item._splitItems) && item._splitItems.length > 0) {
    // A recipe split into its ingredients counts as their sum.
    return sumNutrition(item._splitItems.map(calculateNutrition));
  }
  const factor = toNumber(item.quantity) || 1;
  const result: NutritionValues = {};
  if (item.nutrition && Object.keys(item.nutrition).length > 0) {
    for (const [key, value] of Object.entries(item.nutrition)) {
      if (key !== "_derived") result[key] = toNumber(value) * factor;
    }
  } else {
    for (const { id } of NUTRIMENTS) {
      const value = item[id];
      if (value !== undefined && value !== null && value !== "") {
        result[id] = toNumber(value) * factor;
      }
    }
    if (item.calories_kcal !== undefined && result.calories === undefined) {
      result.calories = toNumber(item.calories_kcal) * factor;
    }
  }
  const complete = deriveSodiumSalt(result);
  delete complete._derived;
  return complete as NutritionValues;
}
