/** Numbers typed with "." or "," (nutritrace/src/lib/decimal-input.js) */

/** NaN when empty or not a number; no thousands separators */
export function parseDecimal(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  return parseFloat(trimmed.replace(",", "."));
}

/** A positive number, or null */
export function parsePositive(value: unknown): number | null {
  const number = parseDecimal(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** A stored number as the text of an input; empty for nothing */
export function toInputValue(value: unknown, decimals = 4): string {
  if (value === null || value === undefined || value === "") return "";
  const number = parseDecimal(value);
  if (!Number.isFinite(number)) return "";
  return String(Math.round(number * 10 ** decimals) / 10 ** decimals);
}
