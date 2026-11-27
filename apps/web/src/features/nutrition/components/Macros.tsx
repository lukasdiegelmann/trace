import { Meter, Stat } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useNutritionFormat } from "../useNutritionFormat";
import { MACRO_COLORS } from "./macroColors";

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
}

/** The split of the macro calories as one bar */
export function MacroBar({
  grams,
  size = "sm",
}: {
  grams: MacroGrams;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation("nutrition");
  const parts = [
    { key: "protein" as const, value: grams.protein * 4 },
    { key: "carbs" as const, value: grams.carbs * 4 },
    { key: "fat" as const, value: grams.fat * 9 },
  ];
  return (
    <Meter
      max={null}
      size={size}
      ariaLabel={t("macros.split")}
      segments={parts.map((part) => ({
        value: Math.round(part.value),
        color: MACRO_COLORS[part.key],
        label: t(`macros.${part.key}`),
      }))}
    />
  );
}

export interface MacroStatsProps {
  /** Left out where there is nothing to show */
  kcal?: number | null;
  grams: MacroGrams;
  /** Targets in grams shown below each figure */
  goals?: Partial<MacroGrams>;
}

/** Energy and the three macros side by side */
export function MacroStats({ kcal, grams, goals }: MacroStatsProps) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  return (
    <div className="grid grid-cols-4 gap-2 compact:grid-cols-2">
      {kcal != null && (
        <Stat
          label={format.energyUnit}
          value={format.number(format.energyValue(kcal), 0)}
        />
      )}
      {(["protein", "carbs", "fat"] as const).map((key) => {
        const goal = goals?.[key];
        return (
          <Stat
            key={key}
            label={t(`macros.${key}`)}
            value={`${format.number(grams[key])} g`}
            hint={goal ? `/ ${format.number(goal, 0)} g` : undefined}
          />
        );
      })}
    </div>
  );
}
