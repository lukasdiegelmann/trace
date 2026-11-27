/**
 * Quantity parsing and formatting for recipe scaling, ported from
 * cooktrace/src/lib/qty.js. Quantities are free text ("1", "1 1/2",
 * "to taste"); what does not parse passes through unchanged.
 */
const COMMON_FRACTIONS: readonly (readonly [number, string])[] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];
const FRACTION_TOLERANCE = 0.03;

export function parseQty(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/^(\d+)\s+and\s+(\d+\s*\/\s*\d+)$/i, "$1 $2");

  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) {
    const result = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return Number.isFinite(result) ? result : null;
  }
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) {
    const result = Number(fraction[1]) / Number(fraction[2]);
    return Number.isFinite(result) ? result : null;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** A number as a cook writes it: snapped to the common fractions */
export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  if (value < 0) return value.toString();
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < FRACTION_TOLERANCE) return String(whole);
  if (1 - rest < FRACTION_TOLERANCE) return String(whole + 1);
  for (const [fraction, label] of COMMON_FRACTIONS) {
    if (Math.abs(rest - fraction) < FRACTION_TOLERANCE) {
      return whole ? `${whole} ${label}` : label;
    }
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function scaleQty(value: string, factor: number | null): string {
  if (factor === 1 || factor === null) return value;
  const number = parseQty(value);
  return number === null ? value : formatQty(number * factor);
}

/** Units read in fractions; weights and metric volumes stay decimal */
export const FRACTION_UNITS: ReadonlySet<string> = new Set([
  "tsp",
  "tbsp",
  "cup",
  "pt",
  "qt",
  "gal",
  "fl oz",
]);

export function displayQty(
  qty: string | number | null | undefined,
  unit: string | null | undefined,
  scale = 1,
): string {
  if (qty === null || qty === undefined || qty === "") return "";
  const number = parseQty(qty);
  if (number === null) return String(qty);
  const scaled = number * (scale || 1);
  if (FRACTION_UNITS.has((unit ?? "").toLowerCase().trim())) {
    return formatQty(scaled);
  }
  if (Number.isInteger(scaled)) return String(scaled);
  return scaled.toFixed(2).replace(/\.?0+$/, "");
}

export interface QtyParts {
  whole: string;
  fraction: string;
}

/** `displayQty` split so the fraction can be set smaller */
export function displayQtyParts(
  qty: string | number | null | undefined,
  unit: string | null | undefined,
  scale = 1,
): QtyParts {
  const text = displayQty(qty, unit, scale);
  const mixed = /^(\d+)\s+(\d+\/\d+)$/.exec(text);
  if (mixed) return { whole: mixed[1], fraction: mixed[2] };
  if (/^\d+\/\d+$/.test(text)) return { whole: "", fraction: text };
  return { whole: text, fraction: "" };
}

/** The editor's tidy-up on blur: "0.25" cup becomes "1/4" */
export function normaliseQtyForUnit(qty: string, unit: string): string {
  if (!qty || !FRACTION_UNITS.has(unit.toLowerCase().trim())) return qty;
  const number = parseQty(qty);
  if (number === null || number < 0) return qty;
  return formatQty(number) || qty;
}
