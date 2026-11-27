import { NUTRIMENTS, type Nutriment } from "./nutrimentCatalog";
import { orderedIds } from "./lists";

export const CUSTOM_UNITS_OF_NUTRIENTS = [
  "g",
  "mg",
  "mcg",
  "IU",
  "kcal",
  "kJ",
  "%",
] as const;

export interface CustomNutriment {
  id: string;
  label: string;
  unit: string;
}

export function customNutrimentList(value: unknown): CustomNutriment[] {
  return Array.isArray(value) ? (value as CustomNutriment[]) : [];
}

/** The old UI's id for a custom nutrient (routes/settings/Nutrients.svelte) */
export function customNutrimentId(label: string): string {
  return `custom_${label.toLowerCase().replace(/\s+/g, "_")}`;
}

/** Adds a custom nutrient; one with the same id changes nothing */
export function addCustomNutriment(
  list: readonly CustomNutriment[],
  label: string,
  unit: string,
): CustomNutriment[] {
  const name = label.trim();
  const id = customNutrimentId(name);
  if (!name || list.some((item) => item.id === id)) return [...list];
  return [...list, { id, label: name, unit }];
}

export function defaultNutrimentIds(app: "nt" | "ct"): string[] {
  return NUTRIMENTS.filter((n: Nutriment) =>
    app === "nt" ? n.isDefaultNt : n.isDefaultCt,
  ).map((n) => n.id);
}

/**
 * The ids a `visibleNutriments` value stands for: null (and in CookTrace an
 * empty list too) means the app's defaults.
 */
export function visibleNutrimentIds(
  app: "nt" | "ct",
  value: unknown,
): string[] {
  if (!Array.isArray(value) || (app === "ct" && value.length === 0)) {
    return defaultNutrimentIds(app);
  }
  return value as string[];
}

/** The built-in ids in the stored `nutrimentsOrder` */
export function orderedNutrimentIds(stored: unknown): string[] {
  return orderedIds(
    NUTRIMENTS.map((n) => n.id),
    stored,
  );
}
