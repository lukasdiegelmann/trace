/**
 * Nutrient definitions and calculations, ported from
 * nutritrace/src/lib/nutrition.js. Storage is always kcal; kJ is display.
 */

export type NutrientCategory =
  "energy" | "macro" | "other" | "mineral" | "vitamin";

export interface Nutrient {
  id: string;
  unit: string;
  category: NutrientCategory;
  /** Part of the default visible set */
  isDefault: boolean;
  /** A top-level row of the Nutrition Facts label */
  isBold: boolean;
  /** FDA Daily Value reference amount */
  dv: number | null;
  /** Indented below this row on the label */
  subOf?: string;
}

/** Nutrition values by nutrient id, `calories` in kcal */
export type NutritionValues = Record<string, number>;

const n = (
  id: string,
  unit: string,
  category: NutrientCategory,
  isDefault: boolean,
  isBold: boolean,
  dv: number | null,
  subOf?: string,
): Nutrient => ({ id, unit, category, isDefault, isBold, dv, subOf });

/** In the order of the US Nutrition Facts label */
export const NUTRIMENTS: readonly Nutrient[] = [
  n("calories", "kcal", "energy", true, true, null),
  n("kilojoules", "kJ", "energy", false, false, null),
  n("fat", "g", "macro", true, true, 78),
  n("saturated-fat", "g", "macro", true, false, 20, "fat"),
  n("trans-fat", "g", "macro", false, false, null, "fat"),
  n("polyunsaturated-fat", "g", "macro", false, false, null, "fat"),
  n("monounsaturated-fat", "g", "macro", false, false, null, "fat"),
  n("cholesterol", "mg", "other", false, true, 300),
  n("sodium", "mg", "mineral", true, true, 2300),
  n("salt", "g", "macro", false, false, null),
  n("carbohydrates", "g", "macro", true, true, 275),
  n("fiber", "g", "macro", true, false, 28, "carbohydrates"),
  n("sugars", "g", "macro", true, false, null, "carbohydrates"),
  n("added-sugars", "g", "macro", true, false, 50, "sugars"),
  n("proteins", "g", "macro", true, true, 50),
  n("vitamin-d", "mcg", "vitamin", true, false, 20),
  n("calcium", "mg", "mineral", true, false, 1300),
  n("iron", "mg", "mineral", true, false, 18),
  n("potassium", "mg", "mineral", true, false, 4700),
  n("vitamin-a", "mcg", "vitamin", false, false, 900),
  n("vitamin-c", "mg", "vitamin", false, false, 90),
  n("vitamin-e", "mg", "vitamin", false, false, 15),
  n("vitamin-k", "mcg", "vitamin", false, false, 120),
  n("b1", "mg", "vitamin", false, false, 1.2),
  n("b2", "mg", "vitamin", false, false, 1.3),
  n("b3", "mg", "vitamin", false, false, 16),
  n("b6", "mg", "vitamin", false, false, 1.7),
  n("b9", "mcg", "vitamin", false, false, 400),
  n("b12", "mcg", "vitamin", false, false, 2.4),
  n("magnesium", "mg", "mineral", false, false, 420),
  n("zinc", "mg", "mineral", false, false, 11),
  n("phosphorus", "mg", "mineral", false, false, 1250),
  n("caffeine", "mg", "other", false, false, null),
  n("alcohol", "g", "other", false, false, null),
];

export const DEFAULT_VISIBLE_NUTRIMENT_IDS = NUTRIMENTS.filter(
  (nutrient) => nutrient.isDefault,
).map((nutrient) => nutrient.id);

/** A user-defined nutrient of the `customNutriments` setting */
export interface CustomNutrient {
  id: string;
  label: string;
  unit: string;
  category?: string;
}

export function nutrientById(id: string): Nutrient | undefined {
  return NUTRIMENTS.find((nutrient) => nutrient.id === id);
}

/** kcal per gram of the macros a percent goal converts with */
export const MACRO_DENSITY: Record<string, number> = {
  fat: 9,
  "saturated-fat": 9,
  carbohydrates: 4,
  sugars: 4,
  proteins: 4,
};

/** % Daily Value, or null without a DV */
export function dvPercent(
  nutrient: Pick<Nutrient, "dv"> | undefined,
  value: unknown,
): number | null {
  if (!nutrient?.dv || value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round((number / nutrient.dv) * 100);
}

/** sodium_mg = salt_g × 400 (EU labelling factor 2.5) */
export const SODIUM_MG_PER_SALT_G = 400;

function isPresent(value: unknown): boolean {
  return value != null && value !== "" && Number(value) > 0;
}

/**
 * Fills whichever of sodium (mg) and salt (g) is missing from the other.
 * Returns the id that was derived, if any. Mutates `nutrition`.
 */
export function deriveSodiumSalt(
  nutrition: Record<string, unknown>,
): "sodium" | "salt" | null {
  const hasSodium = isPresent(nutrition.sodium);
  const hasSalt = isPresent(nutrition.salt);
  if (hasSodium === hasSalt) return null;
  if (hasSodium) {
    nutrition.salt =
      Math.round((Number(nutrition.sodium) / SODIUM_MG_PER_SALT_G) * 1000) /
      1000;
    return "salt";
  }
  nutrition.sodium =
    Math.round(Number(nutrition.salt) * SODIUM_MG_PER_SALT_G * 10) / 10;
  return "sodium";
}

/** What `calculate` needs of a diary item, a meal ingredient or a food */
export interface Calculable {
  quantity?: number | string | null;
  nutrition?: Record<string, unknown> | null;
  _splitItems?: Calculable[] | null;
}

function toNumber(value: unknown): number {
  const number = parseFloat(String(value));
  return Number.isFinite(number) ? number : 0;
}

/** Totals of one item: its nutrition × quantity (servings) */
export function calculate(
  item: Calculable | null | undefined,
): NutritionValues {
  if (!item) return {};
  if (Array.isArray(item._splitItems) && item._splitItems.length > 0) {
    return sumNutrition(item._splitItems.map(calculate));
  }
  const quantity = toNumber(item.quantity) || 1;
  const result: Record<string, unknown> = {};
  if (item.nutrition && Object.keys(item.nutrition).length > 0) {
    for (const [key, value] of Object.entries(item.nutrition)) {
      if (key === "_derived") continue;
      result[key] = toNumber(value) * quantity;
    }
  } else {
    // Legacy flat items
    for (const nutrient of NUTRIMENTS) {
      const value = (item as Record<string, unknown>)[nutrient.id];
      if (value !== undefined && value !== "" && value !== null) {
        result[nutrient.id] = toNumber(value) * quantity;
      }
    }
    const legacyKcal = (item as Record<string, unknown>).calories_kcal;
    if (legacyKcal !== undefined && result.calories === undefined) {
      result.calories = toNumber(legacyKcal) * quantity;
    }
  }
  deriveSodiumSalt(result);
  return result as NutritionValues;
}

/** Every value times `factor`; sodium/salt flags and non-numbers are dropped */
export function scaleNutrition(
  nutrition: Record<string, unknown> | null | undefined,
  factor: number,
): NutritionValues {
  const result: NutritionValues = {};
  for (const [key, value] of Object.entries(nutrition ?? {})) {
    if (key === "_derived") continue;
    const number = parseFloat(String(value));
    if (Number.isFinite(number)) result[key] = number * factor;
  }
  return result;
}

export function sumNutrition(
  values: (NutritionValues | null | undefined)[],
): NutritionValues {
  const result: NutritionValues = {};
  for (const entry of values) {
    if (!entry) continue;
    for (const [key, value] of Object.entries(entry)) {
      result[key] = (result[key] ?? 0) + toNumber(value);
    }
  }
  return result;
}

export interface MacroPercents {
  fat: number;
  carbs: number;
  protein: number;
}

/** P/C/F share of the macro calories (9/4/4), each rounded */
export function macroPercents(
  nutrition: NutritionValues | null | undefined,
): MacroPercents {
  if (!nutrition) return { fat: 0, carbs: 0, protein: 0 };
  const fat = (nutrition.fat || 0) * 9;
  const carbs = (nutrition.carbohydrates || 0) * 4;
  const protein = (nutrition.proteins || 0) * 4;
  const total = fat + carbs + protein;
  if (total === 0) return { fat: 0, carbs: 0, protein: 0 };
  return {
    fat: Math.round((fat / total) * 100),
    carbs: Math.round((carbs / total) * 100),
    protein: Math.round((protein / total) * 100),
  };
}

/**
 * P/C/F percentages of grams' calories that add up to exactly 100 (largest
 * remainder), as MacroRing.svelte shows them
 */
export function macroPercentsExact(grams: {
  proteins: number;
  carbohydrates: number;
  fat: number;
}): MacroPercents {
  const kcal = [grams.proteins * 4, grams.carbohydrates * 4, grams.fat * 9];
  const total = kcal.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { protein: 0, carbs: 0, fat: 0 };
  const raw = kcal.map((value) => (value / total) * 100);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (rest <= 0) break;
    floors[index] += 1;
    rest -= 1;
  }
  return { protein: floors[0], carbs: floors[1], fat: floors[2] };
}

export const KJ_PER_KCAL = 4.184;

export type EnergyUnit = "kcal" | "kJ";

/** A kcal value in the user's unit, rounded */
export function displayEnergy(kcal: unknown, unit: EnergyUnit): number {
  const value = toNumber(kcal);
  return Math.round(unit === "kJ" ? value * KJ_PER_KCAL : value);
}

/** What the user typed in their energy unit, as kcal */
export function energyInputToKcal(value: number, unit: EnergyUnit): number {
  return unit === "kJ" ? value / KJ_PER_KCAL : value;
}

/** Mifflin-St Jeor BMR × activity multiplier (Nutrition.calculateTDEE) */
export function calculateTdee(input: {
  gender?: string | null;
  age?: number | string | null;
  heightCm?: number | string | null;
  weightKg?: number | string | null;
  activity?: string | null;
}): number {
  const height = toNumber(input.heightCm) || 170;
  const weight = toNumber(input.weightKg) || 70;
  const age = parseInt(String(input.age), 10) || 30;
  const bmr =
    height * 6.25 +
    weight * 9.99 -
    age * 4.92 +
    (input.gender === "male" ? 5 : -161);
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * (multipliers[input.activity ?? ""] ?? 1.2));
}

/**
 * Evaluates what the user typed into a number field: a number or simple
 * arithmetic (`2*50+10`). The old UI used `Function()`; this is a small
 * parser with the same result and no eval. Invalid input gives
 * `parseFloat(expr) || 0`.
 */
export function parseExpression(expression: string): number {
  const source = expression.replace(/,/g, ".").replace(/[^0-9+\-*/.()]/g, "");
  let position = 0;
  const peek = () => source[position];
  function parseNumber(): number {
    if (peek() === "(") {
      position += 1;
      const value = parseSum();
      if (peek() !== ")") throw new Error("missing )");
      position += 1;
      return value;
    }
    if (peek() === "-") {
      position += 1;
      return -parseNumber();
    }
    if (peek() === "+") {
      position += 1;
      return parseNumber();
    }
    const match = /^\d*\.?\d+|^\d+\.?/.exec(source.slice(position));
    if (!match) throw new Error("number expected");
    position += match[0].length;
    return parseFloat(match[0]);
  }
  function parseProduct(): number {
    let value = parseNumber();
    while (peek() === "*" || peek() === "/") {
      const operator = peek();
      position += 1;
      const right = parseNumber();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }
  function parseSum(): number {
    let value = parseProduct();
    while (peek() === "+" || peek() === "-") {
      const operator = peek();
      position += 1;
      const right = parseProduct();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  try {
    const value = parseSum();
    if (position !== source.length) throw new Error("trailing input");
    return Number.isFinite(value) ? value : 0;
  } catch {
    return toNumber(expression);
  }
}

/** One decimal, `1.0` as `1` */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
