/**
 * The nutrition facts catalog, ported from cooktrace/src/lib/nutriments.js
 * (NutriTrace's order: the US FDA label). Labels live in the cooking
 * namespace under `cookingCommon.nutriments.<labelKey>`.
 *
 * `subOf` makes an indented sub-row, `bold` the bold label weight, `dv` the
 * FDA Daily Value (2000 kcal), `fdaBlock` the panel placement (`macros`
 * above the thick rule, `micros` below; none: derived, not its own row).
 */

export type NutrimentCategory =
  "energy" | "macro" | "mineral" | "vitamin" | "other";

export interface Nutriment {
  id: string;
  /** camelCase key of the label in `cookingCommon.nutriments` */
  labelKey: string;
  unit: string;
  category: NutrimentCategory;
  isDefault: boolean;
  isBold: boolean;
  isItalic?: boolean;
  dv: number | null;
  subOf?: string;
  fdaBlock?: "macros" | "micros";
}

function row(
  id: string,
  labelKey: string,
  unit: string,
  category: NutrimentCategory,
  isDefault: boolean,
  isBold: boolean,
  dv: number | null,
  extra: Partial<Pick<Nutriment, "subOf" | "fdaBlock" | "isItalic">> = {},
): Nutriment {
  return { id, labelKey, unit, category, isDefault, isBold, dv, ...extra };
}

const M = { fdaBlock: "macros" } as const;
const V = { fdaBlock: "micros" } as const;

export const NUTRIMENTS: readonly Nutriment[] = [
  row("calories", "calories", "kcal", "energy", true, true, null),
  row("kilojoules", "kilojoules", "kJ", "energy", false, false, null),
  row("fat", "fat", "g", "macro", true, true, 78, M),
  row("saturated-fat", "saturatedFat", "g", "macro", true, false, 20, {
    ...M,
    subOf: "fat",
  }),
  row("trans-fat", "transFat", "g", "macro", false, false, null, {
    ...M,
    subOf: "fat",
    isItalic: true,
  }),
  row(
    "polyunsaturated-fat",
    "polyunsaturatedFat",
    "g",
    "macro",
    false,
    false,
    null,
    {
      ...M,
      subOf: "fat",
    },
  ),
  row(
    "monounsaturated-fat",
    "monounsaturatedFat",
    "g",
    "macro",
    false,
    false,
    null,
    {
      ...M,
      subOf: "fat",
    },
  ),
  row("cholesterol", "cholesterol", "mg", "other", false, true, 300, M),
  row("sodium", "sodium", "mg", "mineral", true, true, 2300, M),
  row("salt", "salt", "g", "macro", false, false, null),
  row("carbohydrates", "carbohydrates", "g", "macro", true, true, 275, M),
  row("fiber", "fiber", "g", "macro", true, false, 28, {
    ...M,
    subOf: "carbohydrates",
  }),
  row("sugars", "sugars", "g", "macro", true, false, null, {
    ...M,
    subOf: "carbohydrates",
  }),
  row("added-sugars", "addedSugars", "g", "macro", true, false, 50, {
    ...M,
    subOf: "sugars",
  }),
  row("proteins", "proteins", "g", "macro", true, true, 50, M),
  row("vitamin-d", "vitaminD", "mcg", "vitamin", false, false, 20, V),
  row("calcium", "calcium", "mg", "mineral", false, false, 1300, V),
  row("iron", "iron", "mg", "mineral", false, false, 18, V),
  row("potassium", "potassium", "mg", "mineral", false, false, 4700, V),
  row("vitamin-a", "vitaminA", "mcg", "vitamin", false, false, 900, V),
  row("vitamin-c", "vitaminC", "mg", "vitamin", false, false, 90, V),
  row("vitamin-e", "vitaminE", "mg", "vitamin", false, false, 15, V),
  row("vitamin-k", "vitaminK", "mcg", "vitamin", false, false, 120, V),
  row("b1", "b1", "mg", "vitamin", false, false, 1.2, V),
  row("b2", "b2", "mg", "vitamin", false, false, 1.3, V),
  row("b3", "b3", "mg", "vitamin", false, false, 16, V),
  row("b6", "b6", "mg", "vitamin", false, false, 1.7, V),
  row("b9", "b9", "mcg", "vitamin", false, false, 400, V),
  row("b12", "b12", "mcg", "vitamin", false, false, 2.4, V),
  row("magnesium", "magnesium", "mg", "mineral", false, false, 420, V),
  row("zinc", "zinc", "mg", "mineral", false, false, 11, V),
  row("phosphorus", "phosphorus", "mg", "mineral", false, false, 1250, V),
  row("caffeine", "caffeine", "mg", "other", false, false, null, V),
  row("alcohol", "alcohol", "g", "other", false, false, null, V),
];

/** The ids shown by default (the `visibleNutriments` setting's default) */
export const DEFAULT_VISIBLE_NUTRIMENT_IDS: readonly string[] =
  NUTRIMENTS.filter((n) => n.isDefault).map((n) => n.id);

export function nutrimentById(id: string): Nutriment | undefined {
  return NUTRIMENTS.find((n) => n.id === id);
}

/**
 * The ids the user chose (`visibleNutriments`), else the defaults. The
 * setting is a string array or null.
 */
export function visibleNutrimentIds(setting: unknown): readonly string[] {
  if (Array.isArray(setting) && setting.length > 0) {
    return setting.filter((id): id is string => typeof id === "string");
  }
  return DEFAULT_VISIBLE_NUTRIMENT_IDS;
}

/** A value's % Daily Value, or null without a DV or a valid value */
export function dvPercent(
  nutriment: Pick<Nutriment, "dv"> | null | undefined,
  value: unknown,
): number | null {
  if (!nutriment?.dv || value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round((number / nutriment.dv) * 100);
}

/** sodium_mg = salt_g × 400 (EU factor 2.5, as NutriTrace) */
export const SODIUM_MG_PER_SALT_G = 400;

/** A nutrition object: numbers by id, `_derived` marks auto-filled fields */
export interface Nutrition {
  [id: string]: number | Record<string, boolean> | undefined;
  _derived?: Record<string, boolean>;
}

function isPresent(value: unknown): boolean {
  return value != null && value !== "" && Number(value) > 0;
}

/**
 * Fills whichever of sodium and salt is missing from the other and marks it
 * in `_derived`. Both or neither present: left alone. Mutates and returns.
 */
export function deriveSodiumSalt<T extends Nutrition | null | undefined>(
  nutrition: T,
): T {
  if (!nutrition || typeof nutrition !== "object") return nutrition;
  const hasSodium = isPresent(nutrition.sodium);
  const hasSalt = isPresent(nutrition.salt);
  if (hasSodium === hasSalt) return nutrition;
  const derived: Record<string, boolean> =
    nutrition._derived && typeof nutrition._derived === "object"
      ? nutrition._derived
      : {};
  delete derived.sodium;
  delete derived.salt;
  nutrition._derived = derived;
  if (hasSodium) {
    nutrition.salt =
      Math.round((Number(nutrition.sodium) / SODIUM_MG_PER_SALT_G) * 1000) /
      1000;
    derived.salt = true;
  } else {
    nutrition.sodium =
      Math.round(Number(nutrition.salt) * SODIUM_MG_PER_SALT_G * 10) / 10;
    derived.sodium = true;
  }
  return nutrition;
}

/** True if the id was auto-derived on this nutrition object */
export function isDerived(
  nutrition: Nutrition | null | undefined,
  id: string,
): boolean {
  return Boolean(nutrition?._derived?.[id]);
}

const KCAL_TO_KJ = 4.184;

/** Stored kcal shown in the user's `energyUnit` (rounded) */
export function displayEnergy(kcal: unknown, unit: string): number | null {
  if (kcal == null || kcal === "") return null;
  const number = Number(kcal);
  if (!Number.isFinite(number)) return null;
  return unit === "kJ" ? Math.round(number * KCAL_TO_KJ) : Math.round(number);
}

/** Label key of the energy row: `calories` or `energy` */
export function energyLabelKey(unit: string): "calories" | "energy" {
  return unit === "kJ" ? "energy" : "calories";
}

/** "kcal" or "kJ" */
export function energyUnitSuffix(unit: string): "kcal" | "kJ" {
  return unit === "kJ" ? "kJ" : "kcal";
}

/** A number value of a nutrition object, or undefined */
export function nutrientValue(
  nutrition: Nutrition | null | undefined,
  id: string,
): number | undefined {
  const value = nutrition?.[id];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function without<T extends object>(source: T, ...keys: string[]): T {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.includes(key)),
  ) as T;
}

/**
 * Sets one nutrient from what was typed (PantryItemSheet _setNutrient):
 * blank removes it; typing sodium or salt drops the other so it is derived
 * again from the new value.
 */
export function setNutrient(
  nutrition: Nutrition | null | undefined,
  id: string,
  raw: string,
): Nutrition {
  const value = raw === "" ? undefined : Number(raw);
  const prev = nutrition ?? {};
  let next: Nutrition = { ...prev };
  let derived: Record<string, boolean> = { ...(prev._derived ?? {}) };
  if (value == null || !Number.isFinite(value)) next = without(next, id);
  else next[id] = value;
  if (id === "sodium" || id === "salt") {
    const other = id === "sodium" ? "salt" : "sodium";
    next = without(next, other);
    derived = without(derived, id, other);
  }
  next._derived = derived;
  return deriveSodiumSalt(next);
}

/**
 * Scales every nutrient by `ratio` (linked serving size, rounded to 0.01).
 * Keeps whichever of sodium/salt was typed and derives the other again.
 */
export function scaleNutrition(
  nutrition: Nutrition | null | undefined,
  ratio: number,
): Nutrition {
  const prev = nutrition ?? {};
  const derived: Record<string, boolean> = { ...(prev._derived ?? {}) };
  const scaled: Nutrition = { ...prev, _derived: derived };
  for (const [key, value] of Object.entries(scaled)) {
    if (key === "_derived") continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      scaled[key] = Math.round(value * ratio * 100) / 100;
    }
  }
  if (Number(scaled.sodium) > 0 && !derived.sodium) {
    delete scaled.salt;
    delete derived.salt;
  } else if (Number(scaled.salt) > 0 && !derived.salt) {
    delete scaled.sodium;
    delete derived.sodium;
  }
  return deriveSodiumSalt(scaled);
}

/** Whether a nutrition object holds any value besides `_derived` */
export function hasNutritionValues(
  nutrition: Nutrition | null | undefined,
): boolean {
  if (!nutrition || typeof nutrition !== "object") return false;
  return Object.keys(nutrition).some((key) => key !== "_derived");
}

/** Depth of the sub-row chain (Added Sugars: 2) */
export function nutrimentDepth(nutriment: Nutriment): number {
  let depth = 0;
  let current: Nutriment | undefined = nutriment;
  while (current?.subOf && depth <= 3) {
    depth++;
    current = nutrimentById(current.subOf);
  }
  return depth;
}

/** "15mg": whole when close, else one decimal (NutritionFactsBox fmt) */
export function formatNutrient(value: unknown, unit: string): string {
  if (value == null) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return typeof value === "string" ? value : "";
  const text =
    Math.abs(number - Math.round(number)) < 0.05
      ? String(Math.round(number))
      : number.toFixed(1).replace(/\.0$/, "");
  return text + unit;
}
