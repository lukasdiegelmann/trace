/**
 * The unit catalogue and nutrition scaling across units, ported from
 * nutritrace/src/lib/units.js. A unit is stored as its abbreviation; any
 * other text is accepted and scales by the portion number only.
 */

export type UnitGroupId =
  "custom" | "massMetric" | "massUs" | "volumeMetric" | "volumeUs" | "count";

export interface UnitDefinition {
  abbr: string;
  full: string;
}

export interface UnitGroup {
  id: UnitGroupId;
  units: UnitDefinition[];
}

export const UNIT_GROUPS: readonly UnitGroup[] = [
  {
    id: "massMetric",
    units: [
      { abbr: "g", full: "gram" },
      { abbr: "mg", full: "milligram" },
      { abbr: "kg", full: "kilogram" },
    ],
  },
  {
    id: "massUs",
    units: [
      { abbr: "oz", full: "ounce" },
      { abbr: "lb", full: "pound" },
    ],
  },
  {
    id: "volumeMetric",
    units: [
      { abbr: "ml", full: "milliliter" },
      { abbr: "l", full: "liter" },
    ],
  },
  {
    id: "volumeUs",
    units: [
      { abbr: "tsp", full: "teaspoon" },
      { abbr: "tbsp", full: "tablespoon" },
      { abbr: "fl oz", full: "fluid ounce" },
      { abbr: "cup", full: "cup" },
    ],
  },
  {
    id: "count",
    units: [
      { abbr: "piece", full: "piece" },
      { abbr: "slice", full: "slice" },
    ],
  },
];

/** Grams per unit; volume units by the 1 ml ≈ 1 g water approximation */
export const UNIT_TO_G: Readonly<Record<string, number>> = {
  g: 1,
  mg: 0.001,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  tsp: 4.929,
  tbsp: 14.787,
  "fl oz": 29.574,
  cup: 236.588,
};

const VOLUME_UNITS = new Set(["ml", "l", "tsp", "tbsp", "fl oz", "cup"]);

/** The `customUnits` setting's units as a "Custom" group on top */
export function unitGroupsWithCustoms(customs: unknown): readonly UnitGroup[] {
  const list = Array.isArray(customs)
    ? (customs as (Partial<UnitDefinition> | null)[]).filter(
        (custom): custom is UnitDefinition => Boolean(custom?.abbr),
      )
    : [];
  if (list.length === 0) return UNIT_GROUPS;
  return [
    {
      id: "custom",
      units: list.map((custom) => ({
        abbr: custom.abbr,
        full: custom.full || custom.abbr,
      })),
    },
    ...UNIT_GROUPS,
  ];
}

export function isMassConvertible(unit: string | null | undefined): boolean {
  return Boolean(unit) && unitToGrams(unit) != null;
}

/** `g` for mass units, `ml` for volume units, null for opaque ones */
export function unitSystem(unit: string | null | undefined): "g" | "ml" | null {
  if (!unit) return null;
  const lower = unit.toLowerCase();
  if (["g", "mg", "kg", "oz", "lb"].includes(lower)) return "g";
  if (VOLUME_UNITS.has(lower)) return "ml";
  return null;
}

const NO_SPACE_UNITS = new Set([
  "g",
  "mg",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "mcg",
  "µg",
  "kcal",
  "kj",
  "iu",
  "%",
]);

/** "500g" and "250ml", but "8 slice" and "1 cup" */
export function amountAndUnit(
  amount: number | string,
  unit: string | null | undefined,
): string {
  const text = unit || "g";
  const separator = NO_SPACE_UNITS.has(text.toLowerCase()) ? "" : " ";
  return `${amount}${separator}${text}`;
}

export function unitToGrams(unit: string | null | undefined): number | null {
  if (!unit) return null;
  const factor = UNIT_TO_G[unit.toLowerCase()];
  return typeof factor === "number" ? factor : null;
}

/** A food's household unit: `{ abbr: "slice", grams: 35 }` */
export interface AltUnit {
  abbr: string;
  grams: number;
}

/** `alt_units` as a list, whether it came as an array or a JSON string */
export function parseAltUnits(value: unknown): AltUnit[] | null {
  if (Array.isArray(value)) return value as AltUnit[];
  if (typeof value === "string" && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as AltUnit[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function altUnitGrams(altUnits: unknown, unit: string | null | undefined) {
  const list = parseAltUnits(altUnits);
  if (!list || list.length === 0 || !unit) return null;
  const lower = unit.toLowerCase();
  const rows = list as ({ abbr?: string; grams?: unknown } | null)[];
  for (const row of rows) {
    if (row && (row.abbr || "").toLowerCase() === lower) {
      const grams = Number(row.grams);
      if (Number.isFinite(grams) && grams > 0) return grams;
    }
  }
  return null;
}

/** What scaling needs of a food (or a diary item hydrated from one) */
export interface ScalableFood {
  nutrition_basis?: string | null;
  density_g_ml?: number | string | null;
  alt_units?: unknown;
}

function toCanonicalAmount(
  portion: number,
  unit: string | null | undefined,
  food: ScalableFood | null,
): number | null {
  const baseGrams = unitToGrams(unit);
  if (baseGrams == null) return null;
  const basis = food?.nutrition_basis;
  if (!basis) return portion * baseGrams;
  const isVolume = VOLUME_UNITS.has(String(unit).toLowerCase());
  const isSameSystem =
    (basis === "g" && !isVolume) || (basis === "ml" && isVolume);
  if (isSameSystem) return portion * baseGrams;
  const density = Number(food.density_g_ml);
  if (!Number.isFinite(density) || density <= 0) return null;
  if (basis === "g" && isVolume) return portion * baseGrams * density;
  if (basis === "ml" && !isVolume) return (portion * baseGrams) / density;
  return null;
}

/**
 * The factor nutrition changes by from (origPortion, origUnit) to
 * (newPortion, newUnit): the food's household units first, then the mass
 * table bridged by density, else the plain ratio of the portions.
 */
export function scaleFactor(
  origPortion: unknown,
  origUnit: string | null | undefined,
  newPortion: unknown,
  newUnit: string | null | undefined,
  food: ScalableFood | null = null,
): number {
  const op = parseFloat(String(origPortion));
  const np = parseFloat(String(newPortion));
  const origP = Number.isFinite(op) && op > 0 ? op : 100;
  const newP = Number.isFinite(np) && np > 0 ? np : origP;

  const origAlt = food ? altUnitGrams(food.alt_units, origUnit) : null;
  const newAlt = food ? altUnitGrams(food.alt_units, newUnit) : null;

  const resolve = (
    portion: number,
    unit: string | null | undefined,
    altGrams: number | null,
  ): number | null => {
    if (altGrams != null) {
      if (food?.nutrition_basis !== "ml") return portion * altGrams;
      const density = Number(food.density_g_ml);
      if (Number.isFinite(density) && density > 0) {
        return (portion * altGrams) / density;
      }
      return null;
    }
    return toCanonicalAmount(portion, unit, food);
  };

  const origCanonical = resolve(origP, origUnit, origAlt);
  const newCanonical = resolve(newP, newUnit, newAlt);
  if (origCanonical != null && newCanonical != null && origCanonical > 0) {
    return newCanonical / origCanonical;
  }
  return newP / origP;
}
