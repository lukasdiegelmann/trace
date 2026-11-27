import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatDateSetting, formatTimeSetting } from "./lib/dates";
import { displayEnergy } from "./lib/nutrition";
import { useNtSettings } from "./settings";

export interface NutritionFormat {
  locale: string;
  /** "1,234" in the UI language */
  number: (value: number, maximumFractionDigits?: number) => string;
  /** A kcal value in the user's energy unit, number only */
  energyValue: (kcal: number) => number;
  /** A kcal value with its unit: "2,000 kcal" or "8,368 kJ" */
  energy: (kcal: number) => string;
  energyUnit: "kcal" | "kJ";
  /** A YYYY-MM-DD date in the `dateFormat` setting */
  date: (value: string) => string;
  /** A clock time in the `timeFormat` setting */
  time: (value: Date) => string;
  /** The display name of a meal slot: upstream's English defaults are translated */
  mealName: (name: string) => string;
}

/** Numbers, energy, dates and meal names as the user's settings and language want them */
export function useNutritionFormat(): NutritionFormat {
  const { t, i18n } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const locale = i18n.language;
  const { energyUnit, dateFormat, timeFormat } = settings;

  return useMemo(() => {
    const numberFormats = new Map<number, Intl.NumberFormat>();
    const number = (value: number, maximumFractionDigits = 1) => {
      let format = numberFormats.get(maximumFractionDigits);
      if (!format) {
        format = new Intl.NumberFormat(locale, { maximumFractionDigits });
        numberFormats.set(maximumFractionDigits, format);
      }
      return format.format(value);
    };
    const energyValue = (kcal: number) => displayEnergy(kcal, energyUnit);
    const defaults = new Set(["Breakfast", "Lunch", "Dinner", "Snacks"]);
    return {
      locale,
      number,
      energyValue,
      energy: (kcal: number) => `${number(energyValue(kcal), 0)} ${energyUnit}`,
      energyUnit,
      date: (value: string) => formatDateSetting(value, dateFormat, locale),
      time: (value: Date) => formatTimeSetting(value, timeFormat, locale),
      mealName: (name: string) =>
        defaults.has(name) ? t(`mealNames.${name as "Breakfast"}`) : name,
    };
  }, [locale, energyUnit, dateFormat, timeFormat, t]);
}
