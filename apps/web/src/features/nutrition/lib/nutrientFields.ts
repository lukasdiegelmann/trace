/**
 * Which nutrients the editors show and in what order, ported from
 * FoodEditor.svelte (`_applyOrder`, `visibleFields`) and MealEditor.svelte
 * (`_orderedNutriments`, the totals card). Unlike upstream the meal totals
 * include custom nutriments.
 */
import {
  DEFAULT_VISIBLE_NUTRIMENT_IDS,
  displayEnergy,
  NUTRIMENTS,
  round1,
  type CustomNutrient,
  type EnergyUnit,
  type NutritionValues,
} from "./nutrition";

export interface NutrientField {
  id: string;
  unit: string;
  /** A custom nutriment's own name; null for built-ins (translate by id) */
  label: string | null;
  subOf?: string;
  isCustom: boolean;
}

/** The settings of the same names */
export interface NutrientFieldSettings {
  visibleNutriments?: string[] | null;
  nutrimentsOrder?: string[] | null;
  customNutriments?: CustomNutrient[] | null;
}

/** Listed ids first, in that order; the rest keep their place after them */
export function orderByIds<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[] | null | undefined,
): T[] {
  const rank = (item: T) => {
    const index = order?.indexOf(item.id) ?? -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/** Built-in and custom ids, as a food can store them */
export function allNutrientIds(
  customs: readonly CustomNutrient[] | null | undefined,
): string[] {
  return [
    ...NUTRIMENTS.map((nutrient) => nutrient.id),
    ...(customs ?? []).map((custom) => custom.id),
  ];
}

/**
 * Collapsed: the visible built-ins (an empty or unset list means the default
 * set) plus every custom one. Expanded: all.
 */
export function nutrientFields(
  settings: NutrientFieldSettings,
  shouldShowAll = false,
): NutrientField[] {
  const visible = settings.visibleNutriments?.length
    ? settings.visibleNutriments
    : DEFAULT_VISIBLE_NUTRIMENT_IDS;
  const builtIns = NUTRIMENTS.filter(
    (nutrient) => shouldShowAll || visible.includes(nutrient.id),
  ).map((nutrient): NutrientField => ({
    id: nutrient.id,
    unit: nutrient.unit,
    label: null,
    subOf: nutrient.subOf,
    isCustom: false,
  }));
  const customs = (settings.customNutriments ?? []).map(
    (custom): NutrientField => ({
      id: custom.id,
      unit: custom.unit,
      label: custom.label,
      isCustom: true,
    }),
  );
  return orderByIds([...builtIns, ...customs], settings.nutrimentsOrder);
}

export interface NutrientTotalRow {
  field: NutrientField;
  value: number;
  /** "kJ" for calories in kJ mode */
  unit: string;
}

/** The meal totals card: only what is not zero */
export function nutrientTotalRows(
  totals: NutritionValues,
  settings: NutrientFieldSettings,
  energyUnit: EnergyUnit,
  shouldShowAll = false,
): NutrientTotalRow[] {
  return nutrientFields(settings, shouldShowAll)
    .filter((field) => totals[field.id])
    .map((field) =>
      field.id === "calories" && energyUnit === "kJ"
        ? { field, value: displayEnergy(totals[field.id], "kJ"), unit: "kJ" }
        : { field, value: round1(totals[field.id]), unit: field.unit },
    );
}
