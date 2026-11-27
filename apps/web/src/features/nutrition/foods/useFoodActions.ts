import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { foodsApi, mealsApi, proxyGet } from "../api";
import { useConfirm } from "../components/confirm";
import { useNotify } from "../components/useNotify";
import { cloneMealWrite } from "../lib/mealForm";
import { completeOffFood } from "../lib/sources/openFoodFacts";
import { toFoodWrite } from "../lib/sources/types";
import { useNtSettings } from "../settings";
import { entryName, type Entry, type Tab } from "./entries";
import { offOptions } from "./sourceConfig";

function removeEntry(entry: Entry): Promise<unknown> {
  // Meals and recipes have their own endpoint
  if (entry.kind === "meal") return mealsApi.remove(entry.row.id);
  if (entry.kind === "food") return foodsApi.remove(entry.row.id);
  return Promise.reject(new Error("Not a saved entry"));
}

/** Editing, deleting, cloning and saving copies from the food list */
export function useFoodActions(reload: () => void) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();

  const attempt = async (task: () => Promise<unknown>, message: string) => {
    try {
      await task();
      notify.success(message);
      reload();
      return true;
    } catch (caught) {
      notify.failure(caught);
      return false;
    }
  };

  return {
    edit(entry: Entry) {
      if (entry.kind === "food") {
        void navigate(`/nutrition/foods/edit/${entry.row.id}`);
      } else if (entry.kind === "meal") {
        void navigate(
          `/nutrition/meals/edit/${entry.row.id}${entry.row.is_recipe ? "?recipe=1" : ""}`,
        );
      }
    },

    create(tab: Tab) {
      void navigate(
        tab === "foods"
          ? "/nutrition/foods/edit"
          : tab === "meals"
            ? "/nutrition/meals/edit"
            : "/nutrition/meals/edit?recipe=1",
      );
    },

    async remove(entry: Entry) {
      const isConfirmed = await confirm({
        title: t("foods.deleteConfirm.title", { name: entryName(entry) }),
        confirmText: t("common.delete"),
        isDangerous: true,
      });
      if (!isConfirmed) return false;
      return attempt(() => removeEntry(entry), t("foods.toast.deleted"));
    },

    async removeMany(entries: Entry[]) {
      const isConfirmed = await confirm({
        title: t("foods.manage.confirmTitle", { count: entries.length }),
        description: t("foods.manage.confirmText"),
        confirmText: t("common.delete"),
        isDangerous: true,
      });
      if (!isConfirmed) return false;
      let done = 0;
      let failure: unknown = null;
      for (const entry of entries) {
        try {
          await removeEntry(entry);
          done += 1;
        } catch (caught) {
          failure = caught;
        }
      }
      if (done === entries.length) {
        notify.success(t("foods.manage.deleted", { count: done }));
      } else if (done > 0) {
        notify.error(t("foods.manage.partly", { done, total: entries.length }));
      } else {
        notify.failure(failure);
      }
      reload();
      return true;
    },

    clone(entry: Entry) {
      if (entry.kind !== "meal") return;
      void attempt(
        () =>
          mealsApi.create(
            cloneMealWrite(
              entry.row,
              t("foods.toast.copyName", { name: entry.row.name }),
            ),
          ),
        t("foods.toast.cloned"),
      );
    },

    saveToCatalog(entry: Entry) {
      if (entry.kind === "food") {
        void attempt(
          () => foodsApi.copy(entry.row.id),
          t("foods.toast.savedToCatalog"),
        );
      } else if (entry.kind === "meal") {
        void attempt(
          () => mealsApi.copy(entry.row.id),
          t("foods.toast.savedToCatalog"),
        );
      }
    },

    saveToFoods(entry: Entry) {
      if (entry.kind !== "external") return;
      void attempt(async () => {
        let food = entry.food;
        if (food.source === "off") {
          food = (await completeOffFood(proxyGet, food, offOptions(settings)))
            .food;
        }
        await foodsApi.create(toFoodWrite(food));
      }, t("foods.toast.savedToFoods"));
    },
  };
}
