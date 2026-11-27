/** NutriTrace's built-in units (src/lib/units.js UNIT_GROUPS) */
export const BUILT_IN_UNITS = [
  "g",
  "mg",
  "kg",
  "oz",
  "lb",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "fl oz",
  "cup",
  "piece",
  "slice",
];

export interface CustomUnit {
  abbr: string;
  full: string;
}

/**
 * Adds a custom unit; a built-in or existing abbreviation (in any case)
 * changes nothing. The full name falls back to the abbreviation.
 */
export function addCustomUnit(
  list: readonly CustomUnit[],
  abbr: string,
  full: string,
): CustomUnit[] {
  const short = abbr.trim();
  const lower = short.toLowerCase();
  const isTaken =
    BUILT_IN_UNITS.some((unit) => unit.toLowerCase() === lower) ||
    list.some((unit) => unit.abbr.toLowerCase() === lower);
  if (!short || isTaken) return [...list];
  return [...list, { abbr: short, full: full.trim() || short }];
}

export function customUnitList(value: unknown): CustomUnit[] {
  return Array.isArray(value) ? (value as CustomUnit[]) : [];
}
