/**
 * "Scan label": the model reads a photo of a nutrition table into the food
 * form. Ported from nutritrace/src/routes/FoodEditor.svelte (`scanLabel`),
 * with its prompt.
 */
import { setFoodNutrient, type FoodFormState } from "./foodForm";
import { NUTRIMENTS } from "./nutrition";

export const LABEL_SYSTEM_PROMPT =
  "You are a nutrition label parser. Return JSON only.";

export const LABEL_PROMPT = [
  "Extract nutrition facts from this label image.",
  "Return ONLY a JSON object with these keys (omit keys you cannot read):",
  "  name (string, product name), brand (string), portion (number), unit (string, one of g/ml/oz/fl oz/cup/tsp/tbsp/lb/kg/l/each),",
  "  per_serving (boolean, true if the listed values are per serving, false if per 100g),",
  "  calories (kcal), kilojoules (kJ),",
  "  fat (g), saturated-fat (g), trans-fat (g), polyunsaturated-fat (g), monounsaturated-fat (g),",
  "  carbohydrates (g), sugars (g), added-sugars (g), fiber (g),",
  "  proteins (g),",
  "  sodium (mg), salt (g), potassium (mg), cholesterol (mg),",
  "  calcium (mg), iron (mg), magnesium (mg), zinc (mg), phosphorus (mg),",
  "  vitamin-d (µg), vitamin-a (µg), vitamin-c (mg), vitamin-e (mg), vitamin-k (µg),",
  "  b1 (mg), b2 (mg), b3 (mg), b6 (mg), b9 (µg), b12 (µg),",
  "  caffeine (mg), alcohol (g)",
  "Use numbers, not strings. Use the units specified, not the label's.",
  "No commentary, no markdown — JSON only.",
].join("\n");

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOf(value: unknown): string | null {
  const number = parseFloat(String(value));
  return Number.isFinite(number) ? String(number) : null;
}

/**
 * Overwrites what the label shows, since the label in hand is the truth (a
 * refresh from Open Food Facts differs); everything else stays
 */
export function applyLabel(
  form: FoodFormState,
  label: Record<string, unknown>,
): FoodFormState {
  let next: FoodFormState = {
    ...form,
    name: textOf(label.name) || form.name,
    brand: textOf(label.brand) || form.brand,
    portion: numberOf(label.portion) ?? form.portion,
    unit: textOf(label.unit) || form.unit,
    nutrients: { ...form.nutrients },
    derived: { ...form.derived },
  };
  const read = new Map<string, string>();
  for (const { id } of NUTRIMENTS) {
    const value = numberOf(label[id]);
    if (value !== null) read.set(id, value);
  }
  for (const [id, value] of read) next.nutrients[id] = value;
  // One of sodium and salt alone recomputes the other, as typing it does
  const hasSalt = read.has("salt");
  const hasSodium = read.has("sodium");
  if (hasSalt && hasSodium) {
    next.derived = { ...next.derived, salt: false, sodium: false };
  } else if (hasSalt || hasSodium) {
    const id = hasSalt ? "salt" : "sodium";
    next = setFoodNutrient(next, id, next.nutrients[id]);
  }
  return next;
}
