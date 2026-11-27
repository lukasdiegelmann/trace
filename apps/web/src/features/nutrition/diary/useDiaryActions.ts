import { useTranslation } from "react-i18next";

import {
  activityApi,
  diaryApi,
  mealsApi,
  type ActivityRow,
  type ActivityWrite,
  type DiaryItem,
  type MealItem,
} from "../api";
import { useConfirm } from "../components/confirm";
import { useNotify } from "../components/useNotify";
import { addToDiary, loadDiaryDay, mutateDiaryDay } from "../diaryStore";
import { areAllMealsMarked, emptyUnmarkedMeals } from "../lib/completion";
import {
  appendItems,
  clearMealItems,
  copiesOfItems,
  dayTotals,
  itemsOfMeal,
  mealIndexOf,
  moveMealItems,
  quickCaloriesItem,
  removeItems,
  removeSplitChild,
  splitIngredients,
  toReferenceShape,
  updateItem,
  updateSplitChild,
  type QuickCaloriesInput,
} from "../lib/diary";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { itemName } from "./itemText";
import type { DayGoalState } from "./useDayGoal";
import type { DiaryDayState } from "./useDiaryDay";

const REMINDER_TIP_KEY = "nt:dayCompletionMealTipShown";

/** Everything the diary's menus and dialogs do, with its confirmations and toasts */
export function useDiaryActions(
  date: string,
  state: DiaryDayState,
  goal: DayGoalState,
) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const notify = useNotify();
  const confirm = useConfirm();
  const { day, mutate, replace, bumpRevision } = state;

  const mealName = (index: number) =>
    format.mealName(settings.mealNames[index] ?? String(index + 1));

  /** A write to the day on show, with a toast once it happened */
  const apply = async (
    mutation: Parameters<typeof mutate>[0],
    message?: string,
  ) => {
    const isChanged = await mutate(mutation);
    if (isChanged && message) notify.success(message);
    return isChanged;
  };

  /** A write to any day, shown if it is the one on screen */
  const writeDay = async (
    target: string,
    items: DiaryItem[],
    message: string,
  ) => {
    try {
      const result = await addToDiary(target, items);
      replace(result.day);
      bumpRevision();
      notify.success(message);
    } catch (caught) {
      notify.failure(caught);
    }
  };

  const setDayDone = async (isDone: boolean, marks: number[]) => {
    if (!day) return;
    const before = day;
    replace({
      ...day,
      completed_meals: [...new Set([...day.completed_meals, ...marks])],
      completed_at: isDone ? new Date().toISOString() : null,
    });
    try {
      for (const slot of marks) {
        await diaryApi.setMealCompletion(date, slot, true);
      }
      const answer = await diaryApi.setCompletion(date, isDone);
      replace({
        ...before,
        completed_meals: [...new Set([...before.completed_meals, ...marks])],
        completed_at: answer.completed_at,
      });
      bumpRevision();
    } catch (caught) {
      replace(before);
      notify.failure(caught);
      return false;
    }
    return true;
  };

  const showReminderTip = () => {
    if (settings.notifMealReminders) return;
    try {
      if (localStorage.getItem(REMINDER_TIP_KEY)) return;
      localStorage.setItem(REMINDER_TIP_KEY, "1");
    } catch {
      return;
    }
    notify.info(t("diary.completion.reminderTip"));
  };

  return {
    mealName,

    async toggleDay() {
      if (!day) return;
      if (day.completed_at) {
        if (await setDayDone(false, [])) {
          notify.info(t("diary.completion.reopened"));
        }
        return;
      }
      const empty = emptyUnmarkedMeals(day, settings.mealNames.length);
      if (empty.length > 0) {
        const isConfirmed = await confirm({
          title: t("diary.completion.confirmTitle"),
          description: t("diary.completion.confirmText", {
            meals: empty.map(mealName).join(", "),
          }),
          confirmText: t("diary.completion.complete"),
        });
        if (!isConfirmed) return;
      }
      if (await setDayDone(true, empty)) showReminderTip();
    },

    async toggleMeal(slot: number) {
      if (!day) return;
      const isDone = !day.completed_meals.includes(slot);
      const before = day;
      const marks = isDone
        ? [...day.completed_meals, slot]
        : day.completed_meals.filter((mark) => mark !== slot);
      replace({ ...day, completed_meals: marks });
      try {
        const answer = await diaryApi.setMealCompletion(date, slot, isDone);
        let completedAt = before.completed_at;
        if (
          isDone &&
          !completedAt &&
          areAllMealsMarked(answer.completed_meals, settings.mealNames.length)
        ) {
          completedAt = (await diaryApi.setCompletion(date, true)).completed_at;
          notify.success(t("diary.completion.autoClosed"));
        }
        replace({
          ...before,
          completed_meals: answer.completed_meals,
          completed_at: completedAt,
        });
        bumpRevision();
      } catch (caught) {
        replace(before);
        notify.failure(caught);
      }
    },

    save(uuid: string, changes: Partial<DiaryItem>) {
      void apply(updateItem(uuid, changes));
    },
    saveIngredient(uuid: string, child: number, changes: Partial<DiaryItem>) {
      void apply(updateSplitChild(uuid, child, changes));
    },
    removeIngredient(uuid: string, child: number) {
      void apply(removeSplitChild(uuid, child));
    },
    /** Quick entries of a summed row go without asking, as upstream */
    removeQuick(item: DiaryItem) {
      void apply(removeItems([item.uuid]));
    },

    async remove(item: DiaryItem) {
      const name = itemName(item, t);
      const isConfirmed = await confirm({
        title: t("diary.confirm.deleteTitle", { name }),
        description: t("diary.confirm.deleteText"),
        confirmText: t("common.remove"),
        isDangerous: true,
      });
      if (!isConfirmed) return;
      await apply(removeItems([item.uuid]), t("diary.toast.deleted", { name }));
    },

    async removeMany(uuids: string[]) {
      const isConfirmed = await confirm({
        title: t("diary.confirm.deleteManyTitle", { count: uuids.length }),
        confirmText: t("common.delete"),
        isDangerous: true,
      });
      if (!isConfirmed) return false;
      await apply(
        removeItems(uuids),
        t("diary.toast.deletedMany", { count: uuids.length }),
      );
      return true;
    },

    move(item: DiaryItem, meal: number) {
      if (mealIndexOf(item) === meal) return;
      void apply(
        updateItem(item.uuid, { meal }),
        t("diary.toast.moved", { meal: mealName(meal) }),
      );
    },

    /** Dragged onto another meal: no toast, as upstream */
    drop(uuid: string, meal: number) {
      const item = day?.items.find((entry) => entry.uuid === uuid);
      if (item && mealIndexOf(item) !== meal) {
        void apply(updateItem(uuid, { meal }));
      }
    },

    async moveMeal(from: number, to: number) {
      if (from === to) {
        notify.info(t("diary.toast.sameMeal"));
        return;
      }
      const count = day ? itemsOfMeal(day.items, from).length : 0;
      await apply(
        moveMealItems(from, to),
        t("diary.toast.movedMany", { count, meal: mealName(to) }),
      );
    },

    async clearMeal(meal: number) {
      const count = day ? itemsOfMeal(day.items, meal).length : 0;
      const isConfirmed = await confirm({
        title: t("diary.confirm.clearTitle", { meal: mealName(meal) }),
        description: t("diary.confirm.clearText", { date: format.date(date) }),
        confirmText: t("common.delete"),
        isDangerous: true,
      });
      if (!isConfirmed) return;
      await apply(
        clearMealItems(meal),
        t("diary.toast.cleared", { count, meal: mealName(meal) }),
      );
    },

    copyItem(item: DiaryItem, target: string, meal: number) {
      return writeDay(
        target,
        copiesOfItems([item], meal),
        t("diary.toast.copied", {
          meal: mealName(meal),
          date: format.date(target),
        }),
      );
    },

    async copyMeal(from: number, target: string, meal: number) {
      try {
        // The source day as the server has it now
        const source = await loadDiaryDay(date);
        const copies = copiesOfItems(itemsOfMeal(source.items, from), meal);
        if (copies.length === 0) {
          notify.info(t("diary.toast.nothingToCopy"));
          return;
        }
        const result = await mutateDiaryDay(target, appendItems(copies));
        replace(result.day);
        bumpRevision();
        notify.success(
          t("diary.toast.copiedMany", {
            count: copies.length,
            meal: mealName(meal),
            date: format.date(target),
          }),
        );
      } catch (caught) {
        notify.failure(caught);
      }
    },

    async saveAsMeal(meal: number, name: string) {
      if (!day) return false;
      const items = toReferenceShape(itemsOfMeal(day.items, meal));
      if (items.length === 0) return false;
      try {
        await mealsApi.create({
          name,
          notes: "",
          img_url: "",
          nutrition: dayTotals(items),
          // The logged entries as they are: the snapshot of what was eaten
          items: items.map((item) => ({
            ...item,
            portion: item.portion ?? 100,
            unit: item.unit ?? "g",
          })) as unknown as MealItem[],
        });
        notify.success(t("diary.toast.savedMeal", { name }));
        return true;
      } catch (caught) {
        notify.failure(caught);
        return false;
      }
    },

    quickAdd(meal: number, input: QuickCaloriesInput) {
      void writeDay(
        date,
        [quickCaloriesItem(input, meal)],
        t("diary.toast.quickAdded"),
      );
    },

    /** Splits a logged recipe; returns whether it did */
    async split(item: DiaryItem) {
      let recipe: { portion?: number; quantity?: number } = item;
      let ingredients = item.items ?? [];
      const id = item.food_server_id ?? item.id;
      if (ingredients.length === 0 && typeof id === "number") {
        try {
          const meal = await mealsApi.get(id);
          recipe = meal;
          ingredients = meal.items;
        } catch {
          ingredients = [];
        }
      }
      if (ingredients.length === 0) {
        notify.error(t("diary.toast.splitFailed"));
        return false;
      }
      const children = splitIngredients(item, ingredients, recipe);
      const isDone = await apply(
        updateItem(item.uuid, { _splitItems: children }),
        t("diary.toast.splitDone"),
      );
      return Boolean(isDone);
    },

    async saveActivity(write: ActivityWrite, existing?: ActivityRow) {
      try {
        if (existing) await activityApi.update(existing.id, write);
        else await activityApi.create(write);
        goal.activity.reload();
        bumpRevision();
        return true;
      } catch (caught) {
        notify.failure(caught);
        return false;
      }
    },

    async deleteActivity(row: ActivityRow) {
      try {
        await activityApi.remove(row.id);
        notify.success(t("diary.activity.deleted"));
        goal.activity.reload();
        bumpRevision();
      } catch (caught) {
        notify.failure(caught);
      }
    },
  };
}

export type DiaryActions = ReturnType<typeof useDiaryActions>;
