import { Meter, Stack, Text, Tile } from "@monocircuit/monolithium/components";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { activityApi, diaryApi, wellnessApi, type DiaryDay } from "../api";
import { localDateStr, parseIsoDate, weekOf } from "../lib/dates";
import { calorieGoal, percentOf } from "../lib/dayGoals";
import { dayTotals, waterTotal } from "../lib/diary";
import { weekStatus } from "../lib/week";
import { mlToDisplay, waterUnitLabel } from "../lib/water";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { useResource } from "../useResource";
import { DRAG_MEAL } from "./MealCard";
import type { DayGoalState } from "./useDayGoal";

/** The calendar week around the day on show, with each day's calories */
export function WeekStrip({
  date,
  revision,
  goal,
  onSelect,
  onDropMeal,
}: {
  date: string;
  revision: number;
  goal: DayGoalState;
  onSelect: (date: string) => void;
  onDropMeal: (meal: number, date: string) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const week = weekOf(date);
  const today = localDateStr();
  const isDynamic = settings.calorieGoalMode === "dynamic";
  const isAdjusting =
    settings.diaryShowActivity && settings.calorieAdjustFromActivity;

  const days = useResource(`days-${revision}`, () => diaryApi.all());
  // Per day: yesterday's burn (dynamic goal) and the activity to add
  const extras = useResource(
    isDynamic || isAdjusting
      ? `week-${week[0]}-${String(isDynamic)}-${String(isAdjusting)}-${settings.manualActivityPolicy}-${revision}`
      : null,
    async () =>
      Object.fromEntries(
        await Promise.all(
          week.map(async (iso) => {
            const [burn, sum] = await Promise.all([
              isDynamic ? wellnessApi.caloriesOut(iso).catch(() => null) : null,
              isAdjusting
                ? activityApi
                    .sum(iso, settings.manualActivityPolicy)
                    .catch(() => null)
                : null,
            ]);
            return [
              iso,
              {
                caloriesOut: burn?.calories_out ?? null,
                activityKcal: sum?.effective ?? 0,
              },
            ] as const;
          }),
        ),
      ),
  );
  const byDate = new Map<string, DiaryDay>(
    (days.data ?? []).map((entry) => [entry.date, entry]),
  );

  return (
    <div
      className="grid grid-cols-7 gap-2"
      role="group"
      aria-label={t("diary.week.label")}
    >
      {week.map((iso) => {
        const entry = byDate.get(iso);
        const items = entry?.items ?? [];
        const totals = dayTotals(items);
        const kcal = Math.round(totals.calories || 0);
        const extra = extras.data?.[iso];
        const target =
          calorieGoal({
            goals: settings.goals,
            date: iso,
            mode: settings.calorieGoalMode,
            factor: settings.calorieGoalFactor,
            caloriesOut: extra?.caloriesOut ?? null,
            adaptive: goal.adaptive,
          }).kcal + (extra?.activityKcal ?? 0);
        const status = weekStatus(iso, today, kcal, target);
        const weekday = parseIsoDate(iso).toLocaleDateString(format.locale, {
          weekday: "long",
        });
        const water = waterTotal(entry?.water ?? []);
        // TODO(monolithium): a hover card; the native tooltip until then
        const details = [
          `${format.date(iso)}: ${format.energy(kcal)}`,
          `${t("macros.proteinShort")} ${Math.round(totals.proteins || 0)} g · ${t("macros.carbsShort")} ${Math.round(totals.carbohydrates || 0)} g · ${t("macros.fatShort")} ${Math.round(totals.fat || 0)} g`,
          ...(water > 0
            ? [
                `${t("diary.water.title")}: ${format.number(mlToDisplay(water, settings.waterUnit), 2)} ${waterUnitLabel(settings.waterUnit)}`,
              ]
            : []),
          t("diary.week.foods", { count: items.length }),
        ].join("\n");

        return (
          <div
            key={iso}
            onDragOver={(event) => {
              if (iso === date) return;
              if (!event.dataTransfer.types.includes(DRAG_MEAL)) return;
              event.preventDefault();
              setDragOver(iso);
            }}
            onDragLeave={() => {
              setDragOver(null);
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_MEAL)) return;
              event.preventDefault();
              setDragOver(null);
              onDropMeal(Number(event.dataTransfer.getData(DRAG_MEAL)), iso);
            }}
          >
            <Tile
              onPress={() => {
                onSelect(iso);
              }}
              isSelected={iso === date}
              isHighlighted={iso === today || dragOver === iso}
              isDashed={status === "future" || status === "none"}
              label={`${weekday}, ${t("diary.week.day", {
                date: format.date(iso),
                energy: kcal > 0 ? format.energy(kcal) : "—",
              })}, ${t(`diary.week.status.${status}`)}`}
              title={details}
              padding="sm"
            >
              <Stack gap={1} align="center">
                <Text variant="caption" isTruncated>
                  {weekday}
                </Text>
                <Text variant="heading">{parseIsoDate(iso).getDate()}</Text>
                {settings.diaryShowCompletion && entry?.completed_at && (
                  <CheckCircle2 aria-hidden size={14} />
                )}
                <Text variant="caption">
                  {kcal > 0 ? format.number(format.energyValue(kcal), 0) : "—"}
                </Text>
                <div className="w-full">
                  <Meter
                    ariaLabel={t(`diary.week.status.${status}`)}
                    size="sm"
                    value={percentOf(kcal, target)}
                    max={100}
                    tone={
                      status === "over"
                        ? "danger"
                        : status === "under"
                          ? "muted"
                          : "accent"
                    }
                  />
                </div>
              </Stack>
            </Tile>
          </div>
        );
      })}
    </div>
  );
}
