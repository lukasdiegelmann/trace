import { useTranslation } from "react-i18next";

import {
  bodyStatUnit,
  isBodyStatGoal,
  isShownInKj,
  isWellnessGoal,
} from "../lib/goals";
import { nutrientById } from "../lib/nutrition";
import { useNtSettings } from "../settings";

/** A stat's name and unit as the rows and the editor show them */
export function useGoalStats() {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  return {
    name(id: string): string {
      if (isWellnessGoal(id)) return t(`goals.wellness.${id}`);
      if (isBodyStatGoal(id)) return t(`bodyStats.${id as "weight"}`);
      return t(`nutrients.${id as "calories"}`);
    },
    unit(id: string): string {
      if (isShownInKj(id, settings.energyUnit)) return "kJ";
      if (isBodyStatGoal(id)) {
        return bodyStatUnit(id, settings.weightUnit, settings.lengthUnit);
      }
      if (id === "steps") return t("goals.units.steps");
      if (id === "floors") return t("goals.units.floors");
      const units: Partial<Record<string, string>> = {
        active_minutes: "min",
        calories_out: "kcal",
        sleep_duration_min: "min",
        sleep_efficiency: "%",
        hrv_daily_rmssd: "ms",
        weight_kg: "kg",
        body_fat_pct: "%",
        muscle_mass_kg: "kg",
      };
      return units[id] ?? nutrientById(id)?.unit ?? "";
    },
  };
}
