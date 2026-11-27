/**
 * The rows of the Nutrition Facts label and the detail sheet's header, ported
 * from nutritrace/src/components/ui/{NutritionFactsBox,FoodDetailSheet}.svelte.
 */
import type { NutritionMap } from "../api";
import { parseDecimal } from "./decimal";
import {
  DEFAULT_VISIBLE_NUTRIMENT_IDS,
  displayEnergy,
  dvPercent,
  nutrientById,
  NUTRIMENTS,
  type EnergyUnit,
  type Nutrient,
} from "./nutrition";
import type { OffNutritionStatus } from "./sources/offStatus";
import { derivedFlagsOf, type DerivedFlags } from "./sources/types";

export interface NutritionFactRow {
  id: string;
  unit: string;
  value: number;
  /** Whole within 0.05, else one decimal; without the unit */
  text: string;
  dvPercent: number | null;
  /** Indentation level (0-3) */
  depth: number;
  isBold: boolean;
  /** Worked out from sodium or salt */
  isDerived: boolean;
}

export interface NutritionFacts {
  /** In the energy unit, rounded; null without a calorie row */
  energy: number | null;
  /** Everything but vitamins and minerals */
  macros: NutritionFactRow[];
  vitaminsAndMinerals: NutritionFactRow[];
  isEmpty: boolean;
}

export function formatFactValue(value: number): string {
  return Math.abs(value - Math.round(value)) < 0.05
    ? String(Math.round(value))
    : value.toFixed(1).replace(/\.0$/, "");
}

function depthOf(nutrient: Nutrient): number {
  let depth = 0;
  let current: Nutrient | undefined = nutrient;
  while (current?.subOf && depth <= 3) {
    depth += 1;
    current = nutrientById(current.subOf);
  }
  return depth;
}

/** Visible nutrients above zero (upstream shows no zero rows) */
export function nutritionFacts(
  nutrition: NutritionMap | null | undefined,
  visibleNutriments: string[] | null | undefined,
  energyUnit: EnergyUnit,
  derived: DerivedFlags = derivedFlagsOf(nutrition),
): NutritionFacts {
  const visible = new Set(
    visibleNutriments?.length
      ? visibleNutriments
      : DEFAULT_VISIBLE_NUTRIMENT_IDS,
  );
  let energy: number | null = null;
  const macros: NutritionFactRow[] = [];
  const vitaminsAndMinerals: NutritionFactRow[] = [];
  for (const nutrient of NUTRIMENTS) {
    const value = parseDecimal(nutrition?.[nutrient.id]);
    if (!visible.has(nutrient.id) || !(value > 0)) continue;
    if (nutrient.id === "calories") {
      energy = displayEnergy(value, energyUnit);
      continue;
    }
    const isMicro =
      nutrient.category === "vitamin" || nutrient.category === "mineral";
    const depth = depthOf(nutrient);
    (isMicro ? vitaminsAndMinerals : macros).push({
      id: nutrient.id,
      unit: nutrient.unit,
      value,
      text: formatFactValue(value),
      dvPercent: dvPercent(nutrient, value),
      depth,
      isBold: nutrient.isBold && depth === 0,
      isDerived:
        (nutrient.id === "salt" && !!derived.salt) ||
        (nutrient.id === "sodium" && !!derived.sodium),
    });
  }
  return {
    energy,
    macros,
    vitaminsAndMinerals,
    isEmpty:
      energy === null &&
      macros.length === 0 &&
      vitaminsAndMinerals.length === 0,
  };
}

/** "100 g"; null without a portion (the UI says "per serving") */
export function servingDescription(food: {
  portion?: number | string | null;
  unit?: string | null;
}): string | null {
  const portion = Number(food.portion);
  if (!Number.isFinite(portion) || portion <= 0) return null;
  return `${portion} ${food.unit || "g"}`;
}

/** The sheet's calorie chip; none for a product without real values */
export function energyChip(
  nutrition: NutritionMap | null | undefined,
  energyUnit: EnergyUnit,
  offStatus: OffNutritionStatus = "ok",
): number | null {
  const calories = nutrition?.calories;
  if (offStatus !== "ok" || calories == null) return null;
  return displayEnergy(calories, energyUnit);
}
