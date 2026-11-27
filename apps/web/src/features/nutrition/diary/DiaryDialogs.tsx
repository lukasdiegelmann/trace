import { Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { ActivityRow, DiaryDay } from "../api";
import { AppDialog } from "../components/AppDialog";
import { MacroStats } from "../components/Macros";
import { dayTotals, itemsOfMeal } from "../lib/diary";
import { round1 } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { ActivityDialog } from "./ActivityDialog";
import { BodyStatsDialog } from "./BodyStats";
import { DaySummary } from "./DaySummary";
import { EditItemDialog } from "./EditItemDialog";
import { itemName } from "./itemText";
import { CopyDialog, MoveDialog, SaveMealDialog } from "./MealDialogs";
import { NutrientRows } from "./NutrientRows";
import { QuickAddDialog } from "./QuickAddDialog";
import type { DayGoalState } from "./useDayGoal";
import type { DiaryActions } from "./useDiaryActions";
import type { DiaryDayState } from "./useDiaryDay";
import { WaterPanel } from "./WaterPanel";

export type DiaryDialog =
  | { kind: "edit"; uuid: string; child?: number }
  | { kind: "quickAdd"; meal: number }
  | { kind: "move"; uuid: string }
  | { kind: "copyItem"; uuid: string }
  | { kind: "moveMeal"; meal: number }
  | { kind: "copyMeal"; meal: number; date?: string }
  | { kind: "saveMeal"; meal: number }
  | { kind: "mealTotals"; meal: number }
  | { kind: "water" }
  | { kind: "bodyStats" }
  | { kind: "summary" }
  | { kind: "activity"; activity?: ActivityRow };

/** The one dialog the diary has open */
export function DiaryDialogs({
  dialog,
  day,
  goal,
  actions,
  mutate,
  onClose,
}: {
  dialog: DiaryDialog | null;
  day: DiaryDay;
  goal: DayGoalState;
  actions: DiaryActions;
  mutate: DiaryDayState["mutate"];
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  if (!dialog) return null;
  const find = (uuid: string) => day.items.find((item) => item.uuid === uuid);

  switch (dialog.kind) {
    case "edit": {
      const parent = find(dialog.uuid);
      const item =
        dialog.child === undefined
          ? parent
          : parent?._splitItems?.[dialog.child];
      if (!parent || !item) return null;
      return (
        <EditItemDialog
          item={item}
          isIngredient={dialog.child !== undefined}
          onClose={onClose}
          onSave={(changes) => {
            if (dialog.child === undefined) actions.save(dialog.uuid, changes);
            else actions.saveIngredient(dialog.uuid, dialog.child, changes);
          }}
        />
      );
    }
    case "quickAdd":
      return (
        <QuickAddDialog
          meal={actions.mealName(dialog.meal)}
          onAdd={(input) => {
            actions.quickAdd(dialog.meal, input);
          }}
          onClose={onClose}
        />
      );
    case "move": {
      const item = find(dialog.uuid);
      if (!item) return null;
      return (
        <MoveDialog
          title={t("diary.move.title")}
          onPick={(meal) => {
            actions.move(item, meal);
          }}
          onClose={onClose}
        />
      );
    }
    case "moveMeal":
      return (
        <MoveDialog
          title={t("diary.move.title")}
          onPick={(meal) => void actions.moveMeal(dialog.meal, meal)}
          onClose={onClose}
        />
      );
    case "copyItem": {
      const item = find(dialog.uuid);
      if (!item) return null;
      return (
        <CopyDialog
          name={itemName(item, t)}
          meal={item.meal}
          onCopy={(date, meal) => actions.copyItem(item, date, meal)}
          onClose={onClose}
        />
      );
    }
    case "copyMeal":
      return (
        <CopyDialog
          name={actions.mealName(dialog.meal)}
          meal={dialog.meal}
          date={dialog.date}
          onCopy={(date, meal) => actions.copyMeal(dialog.meal, date, meal)}
          onClose={onClose}
        />
      );
    case "saveMeal":
      return (
        <SaveMealDialog
          suggestion={actions.mealName(dialog.meal)}
          count={itemsOfMeal(day.items, dialog.meal).length}
          onSave={(name) => actions.saveAsMeal(dialog.meal, name)}
          onClose={onClose}
        />
      );
    case "mealTotals": {
      const items = itemsOfMeal(day.items, dialog.meal);
      const totals = dayTotals(items);
      return (
        <AppDialog
          title={t("diary.totals.title", {
            meal: actions.mealName(dialog.meal),
          })}
          onClose={onClose}
        >
          <Stack gap={3}>
            <MacroStats
              kcal={totals.calories || 0}
              grams={{
                protein: round1(totals.proteins || 0),
                carbs: round1(totals.carbohydrates || 0),
                fat: round1(totals.fat || 0),
              }}
            />
            <NutrientRows items={items} />
            <Text variant="caption">
              {t("diary.totals.items", { count: items.length })}
            </Text>
          </Stack>
        </AppDialog>
      );
    }
    case "water":
      return (
        <AppDialog title={t("diary.water.title")} onClose={onClose}>
          <WaterPanel day={day} mutate={mutate} />
        </AppDialog>
      );
    case "bodyStats":
      return <BodyStatsDialog day={day} mutate={mutate} onClose={onClose} />;
    case "summary":
      return (
        <AppDialog
          title={t("diary.summary.title")}
          description={format.date(day.date)}
          onClose={onClose}
        >
          <Stack gap={4}>
            <DaySummary
              items={day.items}
              goals={settings.goals}
              date={day.date}
              goalKcal={goal.goal.kcal}
              adjustedKcal={goal.adjustedKcal}
            />
            <NutrientRows items={day.items} />
          </Stack>
        </AppDialog>
      );
    case "activity":
      return (
        <ActivityDialog
          date={day.date}
          activity={dialog.activity}
          onSave={(write) => actions.saveActivity(write, dialog.activity)}
          onClose={onClose}
        />
      );
  }
}
