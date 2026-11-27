/**
 * "As sold" values from Open Food Facts' v3.5 nutrition sets (#241), ported
 * from nutritrace/src/lib/off-nutrition-sets.js, itself a port of OFF's own
 * code (Nutrition.pm, Units.pm, ProductSchemaChanges.pm). v3 serves one
 * aggregated set and prefers "as prepared"; this builds the set OFF would
 * build without "as prepared" values, in the older API's shape. One
 * deliberate difference from OFF: a nutrient in an unknown unit is skipped.
 */

interface Unit {
  standard: string;
  factor: number;
  isKcal: boolean;
}

// taxonomies/units.txt: [standard unit, conversion factor, names]
const UNIT_ROWS: [string, number, string[]][] = [
  ["%", 1, ["%", "percent"]],
  ["% dv", 1, ["% dv", "%dv", "percent dv"]],
  ["% vol", 1, ["% vol", "%vol", "percent vol"]],
  ["% vol (alcohol)", 1, ["% vol (alcohol)", "percent vol (alcohol)"]],
  ["g", 1e-6, ["mcg", "mcgs", "microgram", "micrograms", "µg"]],
  ["g", 0.001, ["mg", "mgs", "milligram", "milligrams"]],
  ["g", 1, ["g", "gr", "gram", "grams", "grm", "grs"]],
  ["g", 28.349523125, ["onz", "oz", "ozs"]],
  ["g", 453.59237, ["lb", "lbs", "pound", "pounds"]],
  ["g", 500, ["metric pound", "metric pounds", "metric-pound"]],
  ["g", 1000, ["kg", "kgr", "kgs", "kilo", "kilogram", "kilograms", "kilos"]],
  ["iu", 1, ["i.e", "i.u", "ie", "international unit", "iu", "u.i", "ui"]],
  ["kj", 1, ["kilojoule", "kilojoules", "kj", "kjs"]],
  [
    "kj",
    4.184,
    [
      "cal",
      "calorie",
      "calories",
      "cals",
      "kcal",
      "kcals",
      "kilocalorie",
      "kilocalories",
    ],
  ],
  ["ml", 1, ["milliliter", "milliliters", "ml", "mls", "pinch", "pinches"]],
  ["ml", 5, ["metric teaspoon"]],
  ["ml", 10, ["centiliter", "centiliters", "cl", "cls"]],
  [
    "ml",
    29.5735,
    [
      "fl oz",
      "fl. oz",
      "fl. oz.",
      "fl.oz",
      "fl.oz.",
      "floz",
      "fluid ounce",
      "fluid ounces",
      "oza",
    ],
  ],
  ["ml", 30, ["dash", "splash"]],
  ["ml", 100, ["deciliter", "deciliters", "dl", "dls"]],
  ["ml", 240, ["cup", "cups"]],
  ["ml", 1000, ["l", "liter", "liters", "ls"]],
  ["ml", 3785.41, ["gal", "gallon", "gallons", "gals"]],
];
const UNITS = new Map<string, Unit>();
for (const [standard, factor, names] of UNIT_ROWS) {
  for (const name of names) {
    UNITS.set(name, { standard, factor, isKcal: name === "kcal" });
  }
}
function findUnit(unit: unknown): Unit | null {
  return typeof unit === "string"
    ? (UNITS.get(unit.toLowerCase()) ?? null)
    : null;
}

// taxonomies/nutrients.txt: conversion from IU and from % of daily value
const IU: Record<string, number> = {
  "vitamin-a": 0.3,
  "vitamin-d": 0.025,
  "vitamin-d3": 0.025,
  "vitamin-e": 0.666666666666667,
  "vitamin-c": 0.05,
};
const DV: Record<string, number> = {
  "vitamin-a": 1500,
  "vitamin-d": 20,
  "vitamin-d3": 20,
  "vitamin-e": 20,
  "vitamin-k": 80,
  "vitamin-c": 60,
  "vitamin-b1": 1.2,
  "vitamin-b2": 1.7,
  "vitamin-pp": 20,
  "vitamin-b6": 2,
  "vitamin-b9": 400,
  folates: 400,
  "vitamin-b12": 6,
  biotin: 300,
  "pantothenic-acid": 10,
  potassium: 4700,
  chloride: 3400,
  calcium: 1300,
  phosphorus: 1000,
  iron: 18,
  magnesium: 400,
  zinc: 15,
  copper: 2,
  manganese: 2,
  selenium: 70,
  chromium: 120,
  molybdenum: 75,
  iodine: 150,
};
const TAXONOMY_UNIT: Record<string, string | undefined> = {
  "vitamin-a": "µg",
  "vitamin-d": "µg",
  "vitamin-d3": "µg",
  "vitamin-e": "mg",
  "vitamin-k": "µg",
  "vitamin-c": "mg",
  "vitamin-b1": "mg",
  "vitamin-b2": "mg",
  "vitamin-pp": "mg",
  "vitamin-b6": "mg",
  "vitamin-b9": "µg",
  folates: "µg",
  "vitamin-b12": "µg",
  biotin: "µg",
  "pantothenic-acid": "mg",
  potassium: "mg",
  chloride: "mg",
  calcium: "mg",
  phosphorus: "mg",
  iron: "mg",
  magnesium: "mg",
  zinc: "mg",
  copper: "mg",
  manganese: "mg",
  selenium: "µg",
  chromium: "µg",
  molybdenum: "µg",
  iodine: "µg",
  alcohol: "% vol",
  acidity: "% vol",
  cocoa: "%",
  "whole-grain": "%",
  moisture: "%",
  "nova-group": "",
  "fruits-vegetables-nuts": "%",
  "fruits-vegetables-nuts-dried": "%",
  "fruits-vegetables-legumes": "%",
  "collagen-meat-protein-ratio": "%",
};
// A % or no unit: the same value whatever the quantity
function isSameForAnyQuantity(nid: string): boolean {
  const unit = TAXONOMY_UNIT[nid];
  return unit !== undefined && (unit === "" || unit.startsWith("%"));
}

// Nutrition.pm default_unit_for_nid
function defaultUnit(nid: string): string {
  const fixed: Record<string, string | undefined> = {
    "energy-kj": "kJ",
    "energy-kcal": "kcal",
    energy: "kJ",
    alcohol: "% vol",
    "water-hardness": "mmol/l",
    ph: "",
  };
  const known = fixed[nid];
  if (known !== undefined) return known;
  if (nid.startsWith("fruits") || nid.startsWith("collagen")) return "%";
  const unit = TAXONOMY_UNIT[nid];
  if (unit === "%" || unit === "") return unit;
  return "g";
}

interface Nutrient {
  value?: number | null;
  value_computed?: unknown;
  value_string?: unknown;
  unit?: string | null;
  modifier?: string | null;
  source?: string;
}

// Units.pm unit_to_g and friends; undefined for an unknown unit
function unitToG(value: number, unit: unknown): number | undefined {
  const found = findUnit(unit);
  if (!found) return undefined;
  if (found.isKcal) return Math.trunc(value * 4.184 + 0.5);
  return value * found.factor;
}
function gToUnit(value: number, unit: string): number | undefined {
  const found = findUnit(unit);
  if (!found) return undefined;
  if (found.isKcal) return Math.trunc(value / 4.184 + 0.5);
  return value / found.factor;
}
function unitToKcal(value: number, unit: unknown): number {
  return String(unit).toLowerCase() === "kj"
    ? Math.trunc(value / 4.184 + 0.5)
    : value;
}
function unitToKj(value: number, unit: unknown): number {
  return String(unit).toLowerCase() === "kcal"
    ? Math.trunc(value * 4.184)
    : value;
}

// A set's per quantity in g or ml; an unknown or missing unit reads as is
function perToG(quantity: number, unit: unknown): number {
  return findUnit(unit) ? (unitToG(quantity, unit) ?? quantity) : quantity;
}

// Nutrition.pm convert_nutrient_to_standard_unit; false for an unknown unit
function toStandardUnit(nutrient: Nutrient, nid: string): boolean {
  const standard = defaultUnit(nid);
  if (standard === nutrient.unit) return true;
  const upper = (nutrient.unit ?? "").toUpperCase();
  const iu = IU[nid] as number | undefined;
  const dv = DV[nid] as number | undefined;
  if (upper === "IU" && iu !== undefined) {
    if (nutrient.value != null) nutrient.value *= iu;
    nutrient.unit = TAXONOMY_UNIT[nid];
  } else if (upper === "% DV" && dv !== undefined) {
    if (nutrient.value != null) nutrient.value *= dv / 100;
    nutrient.unit = TAXONOMY_UNIT[nid];
  }
  if (nutrient.value != null) {
    if (standard === "kcal") {
      nutrient.value = unitToKcal(nutrient.value, nutrient.unit);
    } else if (standard === "kJ") {
      nutrient.value = unitToKj(nutrient.value, nutrient.unit);
    } else {
      const grams = unitToG(nutrient.value, nutrient.unit);
      if (grams === undefined) return false;
      nutrient.value = grams;
    }
  }
  nutrient.unit = standard;
  return true;
}

interface InputSet {
  preparation?: string;
  source?: string;
  per?: string;
  per_quantity?: number | string | null;
  per_unit?: string | null;
  nutrients?: unknown;
}

// Nutrition.pm convert_nutrient_to_100g; false for an unknown unit
function to100(
  nutrient: Nutrient,
  set: InputSet,
  wantedPer: string | undefined,
): boolean {
  if (set.per === wantedPer) return true;
  const factor = gToUnit(
    perToG(Number(set.per_quantity), set.per_unit),
    wantedPer === "100g" ? "g" : "ml",
  );
  if (factor === undefined || !factor) return false;
  // Perl reads a missing value as 0 here, and so does the older API
  nutrient.value = ((nutrient.value ?? 0) * 100) / factor;
  return true;
}

const PREPARATION = ["prepared", "as_sold"];
const SOURCE = ["manufacturer", "packaging", "usda", "estimate"];
const PER = ["100g", "100ml", "1l", "1kg", "serving"];
function rank(table: string[], key: string | undefined): number {
  const index = table.indexOf(key ?? "");
  return index === -1 ? table.length : index;
}

interface Aggregate {
  preparation?: string;
  per?: string;
  nutrients: Map<string, Nutrient | "skipped">;
}

// Nutrition.pm generate_nutrient_aggregated_set_from_sets + set_nutrient_values
function aggregate(sets: InputSet[]): Aggregate {
  const sorted = [...sets]
    .sort(
      (a, b) =>
        rank(PREPARATION, a.preparation) - rank(PREPARATION, b.preparation) ||
        rank(SOURCE, a.source) - rank(SOURCE, b.source) ||
        rank(PER, a.per) - rank(PER, b.per),
    )
    .filter((set) => set.per_quantity != null && set.per_quantity !== "")
    .filter((set) => perToG(Number(set.per_quantity), set.per_unit) >= 5);
  const result: Aggregate = { nutrients: new Map() };
  const first = sorted.at(0);
  if (!first) return result;
  result.preparation = first.preparation;
  const standard = findUnit(first.per_unit)?.standard;
  if (standard === undefined || standard === "g") result.per = "100g";
  else if (standard === "ml") result.per = "100ml";
  for (const set of sorted) {
    const { nutrients } = set;
    if (
      set.preparation !== result.preparation ||
      !nutrients ||
      typeof nutrients !== "object" ||
      Array.isArray(nutrients)
    ) {
      continue;
    }
    const record = nutrients as Record<string, unknown>;
    for (const nid of Object.keys(record).sort()) {
      if (nid === "energy" || result.nutrients.has(nid)) continue;
      const source = record[nid];
      if (!source || typeof source !== "object") continue;
      const nutrient: Nutrient = { ...(source as Nutrient) };
      delete nutrient.value_string;
      if (nutrient.value == null && nutrient.value_computed != null) {
        nutrient.value = nutrient.value_computed as number;
        delete nutrient.value_computed;
        nutrient.modifier ??= "~";
      }
      // OFF's JSON may send the number as text
      const sent: unknown = nutrient.value;
      if (sent != null) nutrient.value = Number(sent);
      const isUsable =
        (nutrient.value == null || Number.isFinite(nutrient.value)) &&
        toStandardUnit(nutrient, nid) &&
        to100(nutrient, set, result.per);
      // Taken or not, this set settles the nutrient, as in OFF
      result.nutrients.set(
        nid,
        isUsable ? { ...nutrient, source: set.source } : "skipped",
      );
    }
    const kj = result.nutrients.get("energy-kj");
    const kcal = result.nutrients.get("energy-kcal");
    if (kj && kj !== "skipped" && kj.value !== undefined) {
      result.nutrients.set("energy", { ...kj });
    } else if (kcal && kcal !== "skipped" && kcal.value !== undefined) {
      const energy = { ...kcal };
      toStandardUnit(energy, "energy");
      result.nutrients.set("energy", energy);
    }
  }
  return result;
}

// Perl rounds to n significant digits on the exact binary value, a tie going
// to the even digit (C's printf); toPrecision rounds a tie up
function perlSig(x: number, digitCount: number): number {
  if (!Number.isFinite(x) || x === 0 || Math.abs(x) >= 1e21) return x;
  const exact = Math.abs(x).toFixed(100);
  const digits = exact.replace(".", "");
  const first = digits.search(/[1-9]/);
  const exponent = exact.indexOf(".") - 1 - first;
  let head = BigInt(
    digits.slice(first, first + digitCount).padEnd(digitCount, "0"),
  );
  const rest = digits.slice(first + digitCount);
  const next = rest.charAt(0);
  const hasMoreDigits = /[1-9]/.test(rest.slice(1));
  const isAbove = next > "5" || (next === "5" && hasMoreDigits);
  const isTie = next === "5" && !hasMoreDigits;
  if (isAbove || (isTie && head % 2n === 1n)) head += 1n;
  return (
    Math.sign(x) * Number(`${head.toString()}e${exponent - digitCount + 1}`)
  );
}

export interface AsSoldNutriments {
  /** Keys as in a v3 product's `nutriments` */
  nutriments: Record<string, unknown>;
  per: string;
}

/**
 * From a v3.5 product's `nutrition.input_sets`; null without a usable "as
 * sold" set. `servingQuantity` is the product's `serving_quantity`.
 */
export function asSoldNutriments(
  nutrition: unknown,
  servingQuantity: unknown,
): AsSoldNutriments | null {
  const sets = (nutrition as { input_sets?: unknown } | null | undefined)
    ?.input_sets;
  if (!Array.isArray(sets)) return null;
  const asSold = (sets as unknown[]).filter(
    (set): set is InputSet =>
      !!set &&
      typeof set === "object" &&
      (set as InputSet).preparation === "as_sold",
  );
  if (asSold.length === 0) return null;
  const result = aggregate(asSold);
  if (result.preparation !== "as_sold") return null;
  const nutriments: Record<string, unknown> = {};
  const serving = Number(servingQuantity);
  let hasAny = false;
  for (const [nid, nutrient] of result.nutrients) {
    if (nutrient === "skipped") continue;
    const source = nutrient.source ?? "unknown";
    if (source === "estimate" && nid !== "added-sugars") continue;
    // OFF stores 15 significant digits (%.15g) and converts the stored numbers
    const stored =
      nutrient.value == null ? nutrient.value : perlSig(nutrient.value, 15);
    const value = stored ?? 0;
    nutriments[nid] = stored;
    nutriments[`${nid}_100g`] = value;
    nutriments[`${nid}_unit`] = nutrient.unit;
    if (nutrient.modifier != null) {
      nutriments[`${nid}_modifier`] = nutrient.modifier;
    }
    if (isSameForAnyQuantity(nid)) nutriments[`${nid}_serving`] = value;
    else if (Number.isFinite(serving) && serving > 0) {
      // Perl's sprintf("%.2e", x) + 0
      nutriments[`${nid}_serving`] = perlSig((value / 100) * serving, 3);
    }
    hasAny = true;
  }
  // The older API reads a missing per as 100 g
  return hasAny ? { nutriments, per: result.per ?? "100g" } : null;
}
