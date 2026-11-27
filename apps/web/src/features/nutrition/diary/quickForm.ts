import type { DiaryItem } from "../api";
import { toInputValue, parseDecimal } from "../lib/decimal";
import { QUICK_CALORIES_NAME, type QuickCaloriesInput } from "../lib/diary";
import {
  displayEnergy,
  energyInputToKcal,
  type EnergyUnit,
} from "../lib/nutrition";

export interface QuickForm {
  name: string;
  /** In the user's energy unit */
  energy: string;
  proteins: string;
  carbohydrates: string;
  fat: string;
}

export const EMPTY_QUICK_FORM: QuickForm = {
  name: "",
  energy: "",
  proteins: "",
  carbohydrates: "",
  fat: "",
};

export function quickFormOf(item: DiaryItem, unit: EnergyUnit): QuickForm {
  return {
    name: item.name === QUICK_CALORIES_NAME ? "" : item.name,
    energy: String(displayEnergy(item.nutrition.calories ?? 0, unit)),
    proteins: toInputValue(item.nutrition.proteins, 1),
    carbohydrates: toInputValue(item.nutrition.carbohydrates, 1),
    fat: toInputValue(item.nutrition.fat, 1),
  };
}

/** `null` while there is no positive energy value */
export function quickInputOf(
  form: QuickForm,
  unit: EnergyUnit,
): QuickCaloriesInput | null {
  const typed = parseDecimal(form.energy);
  if (!Number.isFinite(typed) || typed <= 0) return null;
  const kcal = Math.round(energyInputToKcal(typed, unit));
  if (kcal <= 0) return null;
  const macro = (value: string) => {
    const number = parseDecimal(value);
    return Number.isFinite(number) ? number : null;
  };
  return {
    kcal,
    name: form.name,
    proteins: macro(form.proteins),
    carbohydrates: macro(form.carbohydrates),
    fat: macro(form.fat),
  };
}
