import {
  Box,
  Meter,
  Pressable,
  Row,
  SegmentedControl,
  Stack,
  Stat,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryDay } from "../api";
import { MACRO_COLORS } from "../components/macroColors";
import { MacroBar } from "../components/Macros";
import { nutrientBars, percentOf, targetFor } from "../lib/dayGoals";
import { dayTotals, waterTotal } from "../lib/diary";
import { macroPercents, round1 } from "../lib/nutrition";
import { mlToDisplay, waterUnitLabel } from "../lib/water";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import type { DayGoalState } from "./useDayGoal";
import { useCelebration } from "./useCelebration";

const MACROS = [
  ["protein", "proteins"],
  ["carbs", "carbohydrates"],
  ["fat", "fat"],
] as const;

/** The day's totals along the bottom of narrow screens; unfolds to more */
export function TotalsBar({
  day,
  goal,
}: {
  day: DiaryDay;
  goal: DayGoalState;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const [isOpen, setIsOpen] = useState(false);

  const totals = dayTotals(day.items);
  const kcal = Math.round(totals.calories || 0);
  const calPercent = percentOf(kcal, goal.adjustedKcal);
  const water = waterTotal(day.water);
  const waterPercent = percentOf(water, settings.waterGoalMl);
  const canCelebrate = settings.goalCelebrations && !settings.disableAnimations;
  const isCalorieParty = useCelebration(calPercent, day.date, canCelebrate);
  const isWaterParty = useCelebration(waterPercent, day.date, canCelebrate);

  const isRemaining = settings.diaryTotalsMode === "remaining";
  const percents = macroPercents(totals);
  const grams = {
    protein: totals.proteins || 0,
    carbs: totals.carbohydrates || 0,
    fat: totals.fat || 0,
  };
  const waterText = (ml: number) =>
    `${format.number(mlToDisplay(ml, settings.waterUnit), 2)} ${waterUnitLabel(settings.waterUnit)}`;
  const marker =
    goal.goal.source === "dynamic"
      ? t("diary.bar.dynamic")
      : goal.goal.source === "adaptive"
        ? t("diary.bar.adaptive")
        : null;

  const calorieMeter = (
    <div className={isCalorieParty ? "animate-pulse" : undefined}>
      <Meter
        ariaLabel={t("diary.bar.calories")}
        size="sm"
        value={Math.min(kcal, goal.adjustedKcal)}
        max={Math.max(1, goal.adjustedKcal)}
        tone={kcal >= goal.adjustedKcal ? "danger" : "accent"}
      />
    </div>
  );
  const waterMeter = settings.waterShowInDiary && (
    <div className={isWaterParty ? "animate-pulse" : undefined}>
      <Meter
        ariaLabel={t("diary.water.title")}
        size="sm"
        value={Math.min(water, settings.waterGoalMl)}
        max={Math.max(1, settings.waterGoalMl)}
        segments={[
          {
            value: Math.min(water, settings.waterGoalMl),
            color: "var(--color-incoming)",
          },
        ]}
      />
    </div>
  );

  return (
    <div className="sticky bottom-0 z-10">
      <Box surface="raised" border="top" paddingX={4} paddingY={2}>
        <Stack gap={2}>
          {isOpen && (
            <Stack gap={3} className="max-h-[50dvh] overflow-y-auto">
              <SegmentedControl<"consumed" | "remaining">
                aria-label={t("diary.bar.mode")}
                options={[
                  { value: "consumed", label: t("diary.bar.consumed") },
                  { value: "remaining", label: t("diary.bar.remaining") },
                ]}
                value={settings.diaryTotalsMode}
                onChange={(mode) => {
                  set("diaryTotalsMode", mode);
                }}
              />
              <Text variant="heading">
                {t(isRemaining ? "diary.bar.left" : "diary.bar.eaten", {
                  energy: format.energy(
                    isRemaining ? goal.adjustedKcal - kcal : kcal,
                  ),
                })}
              </Text>
              {marker && <Text variant="caption">{marker}</Text>}
              <div className="grid grid-cols-3 gap-2">
                {MACROS.map(([macro, id]) => {
                  const target = targetFor(
                    settings.goals,
                    id,
                    day.date,
                    goal.goal.kcal,
                  );
                  const value =
                    isRemaining && target !== null
                      ? target - grams[macro]
                      : grams[macro];
                  return (
                    <Stat
                      key={macro}
                      label={t(`macros.${macro}`)}
                      value={`${format.number(round1(value))} g`}
                    />
                  );
                })}
              </div>
              {isRemaining && goal.addedActivityKcal > 0 && (
                <Text variant="caption">
                  {t("diary.bar.breakdown", {
                    goal: format.energy(goal.goal.kcal),
                    activity: format.energy(goal.addedActivityKcal),
                    total: format.energy(goal.adjustedKcal),
                  })}
                </Text>
              )}
              {settings.waterShowInDiary && (
                <Meter
                  label={t(
                    isRemaining ? "diary.bar.waterLeft" : "diary.bar.waterOf",
                    {
                      amount: waterText(
                        isRemaining
                          ? Math.max(0, settings.waterGoalMl - water)
                          : water,
                      ),
                      goal: waterText(settings.waterGoalMl),
                    },
                  )}
                  size="sm"
                  value={Math.min(water, settings.waterGoalMl)}
                  max={Math.max(1, settings.waterGoalMl)}
                  valueText={`${isRemaining ? 100 - waterPercent : waterPercent}%`}
                />
              )}
              {settings.diaryShowNutritionBar &&
                nutrientBars(
                  settings.goals,
                  totals,
                  day.date,
                  goal.goal.kcal,
                  format.energyUnit,
                ).map((bar) => {
                  const unit = settings.diaryShowNutritionUnits
                    ? ` ${bar.unit}`
                    : "";
                  return (
                    <Meter
                      key={bar.id}
                      label={t(`nutrients.${bar.id as "calories"}`)}
                      size="sm"
                      // Meter turns red past its max: a minimum goal stays full
                      segments={[
                        {
                          value: bar.isOver
                            ? bar.current
                            : Math.min(bar.current, bar.target),
                          color: bar.macro
                            ? MACRO_COLORS[bar.macro]
                            : "var(--color-accent)",
                        },
                      ]}
                      max={Math.max(1, bar.target)}
                      valueText={`${format.number(round1(bar.current))} / ${format.number(round1(bar.target))}${unit}`}
                    />
                  );
                })}
            </Stack>
          )}
          <Pressable
            onPress={() => {
              setIsOpen(!isOpen);
            }}
            isExpanded={isOpen}
            label={t(isOpen ? "diary.bar.collapse" : "diary.bar.expand")}
            gap={1}
            fill="width"
          >
            {!isOpen && (
              <>
                {calorieMeter}
                <MacroBar grams={grams} />
                {waterMeter}
              </>
            )}
            <Row gap={2} align="center" justify="between">
              <Text variant="small">
                {[
                  `${percents.protein}% ${t("macros.proteinShort")}`,
                  `${percents.carbs}% ${t("macros.carbsShort")}`,
                  `${percents.fat}% ${t("macros.fatShort")}`,
                  format.energy(kcal),
                  ...(settings.waterShowInDiary ? [waterText(water)] : []),
                ].join(" · ")}
              </Text>
              {isOpen ? (
                <ChevronDown aria-hidden size={16} />
              ) : (
                <ChevronUp aria-hidden size={16} />
              )}
            </Row>
          </Pressable>
        </Stack>
      </Box>
    </div>
  );
}
