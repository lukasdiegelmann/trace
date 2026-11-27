export interface NumberLimits {
  min?: number;
  max?: number;
  /** Taken when the text isn't a number */
  fallback?: number;
  isInteger?: boolean;
}

/** Decimal commas work; the value is clamped into [min, max] */
export function parseNumberInput(
  text: string,
  {
    min = -Infinity,
    max = Infinity,
    fallback,
    isInteger = false,
  }: NumberLimits = {},
): number | null {
  const normalized = text.trim().replace(",", ".");
  const parsed = normalized === "" ? NaN : Number(normalized);
  if (!Number.isFinite(parsed)) return fallback ?? null;
  const rounded = isInteger ? Math.trunc(parsed) : parsed;
  return Math.min(max, Math.max(min, rounded));
}
