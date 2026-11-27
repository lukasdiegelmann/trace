import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import {
  foodsApi,
  integrationsApi,
  mealsApi,
  proxyGet,
  type DiaryItem,
  type FoodRow,
  type MealRow,
} from "../api";
import { useNotify } from "../components/useNotify";
import { addToDiary, mutateDiaryDay } from "../diaryStore";
import {
  diaryPath,
  type FoodEditorState,
  type MealEditorState,
  type PickContext,
} from "../editorLinks";
import { newDiaryItem, removeItems } from "../lib/diary";
import { localDateStr } from "../lib/dates";
import { staleIngredientNames } from "../lib/mealForm";
import {
  diarySource,
  loggableFood,
  loggableRecipe,
  mealDiaryItems,
  storedAmount,
  type Amount,
  type Loggable,
} from "../lib/pickItems";
import {
  getCooktraceRecipe,
  mapCooktraceRecipe,
} from "../lib/sources/cooktrace";
import { getMealieRecipe, mapMealieRecipe } from "../lib/sources/mealie";
import { completeOffFood, resolveOffPicks } from "../lib/sources/openFoodFacts";
import { toFoodWrite, type ExternalFood } from "../lib/sources/types";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { entryName, type Entry, type Tab } from "./entries";
import { cooktraceConfig, mealieConfig, offOptions } from "./sourceConfig";

/** Amounts still to be asked for before logging */
export interface PendingLog {
  foods: Loggable[];
  slot: number;
  date: string;
  /** `leave` goes back to the diary, `stay` keeps the list */
  after: "leave" | "stay";
}

export interface Library {
  foods: FoodRow[];
  meals: MealRow[];
  recipes: MealRow[];
}

/** Everything that puts something from the food list into the diary */
export function usePickActions(
  pick: PickContext | null,
  library: Library | null,
  reload: () => void,
) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const navigate = useNavigate();
  const notify = useNotify();
  const [pending, setPending] = useState<PendingLog | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // One pick at a time: a double tap must not log twice
  const isRunning = useRef(false);

  const mealName = (slot: number) =>
    format.mealName(settings.mealNames[slot] ?? String(slot + 1));

  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (isRunning.current) return;
      isRunning.current = true;
      setIsBusy(true);
      try {
        await task();
      } catch (caught) {
        notify.failure(caught);
      } finally {
        isRunning.current = false;
        setIsBusy(false);
      }
    },
    [notify],
  );

  const leave = (date: string) => {
    void navigate(diaryPath(date), { replace: true });
  };

  /** Writes the entries; a replaced entry goes only once the new ones exist */
  const log = async (items: DiaryItem[], date: string) => {
    await addToDiary(date, items);
    if (pick?.replace) {
      await mutateDiaryDay(date, removeItems([pick.replace]));
    }
  };

  const logAmounts = async (
    request: Omit<PendingLog, "foods">,
    foods: Loggable[],
    amounts: Amount[],
  ) => {
    const items = foods.map((food, index) =>
      newDiaryItem(diarySource(food, amounts[index]), request.slot),
    );
    await log(items, request.date);
    if (request.after === "stay") {
      notify.success(
        t("foods.toast.addedTo", { meal: mealName(request.slot) }),
      );
      return;
    }
    notify.success(
      pick?.replace
        ? t("diary.toast.replaced")
        : items.length > 1
          ? t("foods.toast.addedCount", { count: items.length })
          : t("foods.toast.added"),
    );
    leave(request.date);
  };

  /** Asks for amounts when the settings say so, else logs as stored */
  const offer = async (request: PendingLog) => {
    if (settings.diaryPromptQuantity) {
      setPending(request);
      return;
    }
    await logAmounts(request, request.foods, request.foods.map(storedAmount));
  };

  /** A shared or outside food as one of the user's own */
  const ownFood = async (entry: Entry): Promise<FoodRow | null> => {
    if (entry.kind === "food") {
      if (!entry.isShared) return entry.row;
      const copy = await foodsApi.copy(entry.row.id);
      notify.success(t("foods.toast.savedToCatalog"));
      reload();
      return copy;
    }
    if (entry.kind === "external") {
      return foodsApi.create(toFoodWrite(entry.food));
    }
    return null;
  };

  const ownMeal = async (entry: Extract<Entry, { kind: "meal" }>) => {
    if (!entry.isShared) return entry.row;
    const copy = await mealsApi.copy(entry.row.id);
    notify.success(t("foods.toast.savedToCatalog"));
    reload();
    return copy;
  };

  const openFoodEditor = (prefill: ExternalFood) => {
    const state: FoodEditorState = { prefill, pick: pick ?? undefined };
    void navigate("/nutrition/foods/edit", { state });
  };

  const expandMeals = async (meals: MealRow[], context: PickContext) => {
    const items = meals.flatMap((meal) => mealDiaryItems(meal, context.meal));
    if (items.length === 0) {
      notify.error(t("foods.toast.mealEmpty"));
      return;
    }
    await log(items, context.date);
    for (const meal of meals) {
      if (meal.id) mealsApi.markUsed(meal.id, context.date).catch(() => {});
    }
    const stale = library
      ? staleIngredientNames(
          meals.flatMap((meal) => meal.items),
          [library.foods, library.meals, library.recipes],
        )
      : [];
    if (stale.length > 0) {
      notify.info(t("foods.toast.mealStale", { names: stale.join(", ") }));
    } else {
      notify.success(
        meals.length > 1
          ? t("foods.toast.addedCount", { count: items.length })
          : t("foods.toast.added"),
      );
    }
    leave(context.date);
  };

  return {
    pending,
    cancelPending: () => {
      setPending(null);
    },
    isBusy,

    confirmPending(amounts: Amount[]) {
      const request = pending;
      if (!request) return;
      setPending(null);
      void run(() => logAmounts(request, request.foods, amounts));
    },

    /** A row tapped while picking for the diary */
    pickEntry(entry: Entry, tab: Tab) {
      if (!pick) return;
      void run(async () => {
        if (entry.kind === "mealie") {
          const recipe = await getMealieRecipe(
            integrationsApi.mealie,
            mealieConfig(settings),
            entry.recipe.slug,
          );
          if (recipe) {
            openFoodEditor(mapMealieRecipe(recipe, settings.mealieBaseUrl));
          }
          return;
        }
        if (entry.kind === "ctRecipe") {
          const recipe = await getCooktraceRecipe(
            integrationsApi.cooktrace,
            cooktraceConfig(settings),
            entry.recipe.id,
          );
          if (!recipe) return;
          const state: MealEditorState = {
            prefill: mapCooktraceRecipe(recipe),
          };
          void navigate("/nutrition/meals/edit?recipe=1", { state });
          return;
        }
        if (entry.kind === "meal") {
          const meal = await ownMeal(entry);
          if (tab === "meals") {
            await expandMeals([meal], pick);
            return;
          }
          await offer({
            foods: [loggableRecipe(meal)],
            slot: pick.meal,
            date: pick.date,
            after: "leave",
          });
          return;
        }
        let chosen: Entry = entry;
        if (entry.kind === "external") {
          if (entry.food.source === "cooktracePantry") {
            openFoodEditor(entry.food);
            return;
          }
          if (entry.food.source === "off") {
            const { food, status } = await completeOffFood(
              proxyGet,
              entry.food,
              offOptions(settings),
            );
            // Without usable values it would log 0 kcal (#241 upstream)
            if (status !== "ok") {
              openFoodEditor(food);
              return;
            }
            chosen = { ...entry, food };
          }
        }
        const food = await ownFood(chosen);
        if (!food) return;
        await offer({
          foods: [loggableFood(food)],
          slot: pick.meal,
          date: pick.date,
          after: "leave",
        });
      });
    },

    /** The "add N" button of multi-selection */
    addSelected(entries: Entry[], tab: Tab) {
      if (!pick || entries.length === 0) return;
      void run(async () => {
        if (tab === "meals") {
          const meals: MealRow[] = [];
          for (const entry of entries) {
            if (entry.kind === "meal") meals.push(await ownMeal(entry));
          }
          await expandMeals(meals, pick);
          return;
        }
        const outside = entries.flatMap((entry) =>
          entry.kind === "external" ? [entry.food] : [],
        );
        const { keep, skipped } = await resolveOffPicks<ExternalFood>(
          proxyGet,
          outside,
          offOptions(settings),
        );
        if (skipped.length > 0) {
          notify.error(
            t("foods.toast.offSkipped", { names: skipped.join(", ") }),
          );
        }
        const foods: Loggable[] = [];
        for (const entry of entries) {
          if (entry.kind === "meal") {
            foods.push(loggableRecipe(await ownMeal(entry)));
          } else if (entry.kind === "food") {
            const food = await ownFood(entry);
            if (food) foods.push(loggableFood(food));
          }
        }
        for (const food of keep) {
          foods.push(loggableFood(await foodsApi.create(toFoodWrite(food))));
        }
        if (foods.length === 0) return;
        await offer({
          foods,
          slot: pick.meal,
          date: pick.date,
          after: "leave",
        });
      });
    },

    /** Yesterday's entries of one meal, logged again */
    repeat(items: DiaryItem[]) {
      if (!pick) return;
      void run(async () => {
        await log(
          items.map((item) => newDiaryItem(item, pick.meal)),
          pick.date,
        );
        notify.success(t("foods.toast.addedCount", { count: items.length }));
        leave(pick.date);
      });
    },

    /** "Add to diary" of the detail view while browsing: today, stays here */
    logFromDetail(entry: Entry, slot: number) {
      void run(async () => {
        let loggable: Loggable | null = null;
        if (entry.kind === "meal") {
          loggable = loggableRecipe(await ownMeal(entry));
        } else {
          let chosen: Entry = entry;
          if (entry.kind === "external" && entry.food.source === "off") {
            const { food } = await completeOffFood(
              proxyGet,
              entry.food,
              offOptions(settings),
            );
            chosen = { ...entry, food };
          }
          const food = await ownFood(chosen);
          if (food) loggable = loggableFood(food);
        }
        if (!loggable) {
          notify.error(
            t("foods.toast.importFailed", { message: entryName(entry) }),
          );
          return;
        }
        await offer({
          foods: [loggable],
          slot,
          date: localDateStr(),
          after: "stay",
        });
      });
    },
  };
}

export type PickActions = ReturnType<typeof usePickActions>;
