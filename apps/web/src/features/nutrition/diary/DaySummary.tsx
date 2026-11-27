import {
  Meter,
  SegmentedControl,
  Stack,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { DiaryItem, Goals } from "../api";
import { MacroBar, MacroStats } from "../components/Macros";
import { targetFor } from "../lib/dayGoals";
import { dayTotals } from "../lib/diary";
import { macroPercentsExact, round1 } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/**
 * Calories against the day's goal and the macro split, as percent or grams.
 * TODO(monolithium): a donut chart (upstream's MacroRing); Meter until then.
 */
export function DaySummary({
  items,
  goals,
  date,
  goalKcal,
  adjustedKcal,
}: {
  items: DiaryItem[];
  goals: Goals;
  date: string;
  goalKcal: number;
  adjustedKcal: number;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const totals = dayTotals(items);
  const grams = {
    protein: round1(totals.proteins || 0),
    carbs: round1(totals.carbohydrates || 0),
    fat: round1(totals.fat || 0),
  };
  const percents = macroPercentsExact({
    proteins: grams.protein,
    carbohydrates: grams.carbs,
    fat: grams.fat,
  });
  const isGrams = settings.macroLegendMode === "grams";
  const goalOf = (id: string) =>
    targetFor(goals, id, date, goalKcal) ?? undefined;
  const kcal = totals.calories || 0;

  return (
    <Stack gap={3}>
      <Meter
        label={format.energyUnit}
        value={format.energyValue(kcal)}
        max={Math.max(1, format.energyValue(adjustedKcal))}
        valueText={`${format.number(format.energyValue(kcal), 0)} / ${format.energy(adjustedKcal)}`}
        size="lg"
      />
      <MacroBar grams={grams} size="md" />
      {isGrams ? (
        <MacroStats
          grams={grams}
          goals={{
            protein: goalOf("proteins"),
            carbs: goalOf("carbohydrates"),
            fat: goalOf("fat"),
          }}
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(["protein", "carbs", "fat"] as const).map((key) => (
            <Meter
              key={key}
              label={t(`macros.${key}`)}
              value={percents[key]}
              max={100}
              valueText={`${percents[key]}%`}
              size="sm"
            />
          ))}
        </div>
      )}
      <SegmentedControl<"percent" | "grams">
        aria-label={t("diary.summary.legend")}
        options={[
          { value: "percent", label: t("diary.summary.percent") },
          { value: "grams", label: t("diary.summary.grams") },
        ]}
        value={settings.macroLegendMode}
        onChange={(mode) => {
          set("macroLegendMode", mode);
        }}
      />
    </Stack>
  );
}
