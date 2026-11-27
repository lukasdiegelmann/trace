/**
 * The tools that write nothing: they show a card the user confirms
 * (Trace.svelte's two review cards). The assistant adds "Discard".
 */

import type { AssistantCard, TurnContext } from "@/features/shared/ai";
import { i18n } from "@/i18n";

import { foodsApi, type FoodRow } from "../api";
import { addToDiary, announceDiaryChange } from "../diaryStore";
import { localDateStr } from "../lib/dates";
import { newDiaryItem, quickCaloriesItem } from "../lib/diary";
import {
  displayEnergy,
  NUTRIMENTS,
  type NutritionValues,
} from "../lib/nutrition";
import { diarySource, loggableFood, storedAmount } from "../lib/pickItems";
import { amountAndUnit } from "../lib/units";
import {
  dateArg,
  mealSlotArg,
  nutritionArg,
  positiveArg,
  textArg,
  type Args,
} from "./args";
import {
  loadAssistantSettings,
  mealNamesOf,
  type AssistantSettings,
} from "./settings";

export const QUICK_CARD = "nutrition:quickCalories";
export const FOOD_CARD = "nutrition:food";

const NO_CALORIES = "nutrition.calories must be a positive number.";

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

/** A meal's name in the UI language: the old defaults are translated */
export function mealLabel(name: string): string {
  const known = DEFAULT_MEALS.find((entry) => entry === name);
  return known ? i18n.t(`nutrition:mealNames.${known}`) : name;
}

function mealOptions(names: string[]) {
  return names.map((name, index) => ({
    value: String(index),
    label: mealLabel(name),
  }));
}

function nutrientRows(
  nutrition: NutritionValues,
  energyUnit: AssistantSettings["energyUnit"],
): [string, string][] {
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
      value,
    );
  return NUTRIMENTS.filter((nutrient) =>
    Object.hasOwn(nutrition, nutrient.id),
  ).map((nutrient) => {
    const value = nutrition[nutrient.id];
    return [
      i18n.t(`nutrition:nutrients.${nutrient.id as "calories"}`),
      nutrient.id === "calories"
        ? `${number(displayEnergy(value, energyUnit))} ${energyUnit}`
        : `${number(value)} ${nutrient.unit}`,
    ];
  });
}

async function proposeQuickCalories(args: Args, turn: TurnContext) {
  const settings = await loadAssistantSettings();
  if (!settings.showQuickCalories) {
    return {
      error:
        "Quick Calories logging is disabled. The user must turn on Settings → Diary → Show Quick Calories Button before you can propose a quick entry.",
    };
  }
  const nutrition = nutritionArg(args.nutrition);
  if (!nutrition) return { error: NO_CALORIES };
  const names = mealNamesOf(settings);
  const meal = mealSlotArg(args.meal, names.length);
  const name =
    typeof args.name === "string" ? textArg(args.name, 60) : "Estimated meal";
  const date = dateArg(args.date);
  const servingSize = textArg(args.serving_size, 80);
  const grams = positiveArg(args.serving_grams);
  const servingGrams = grams === null ? null : Math.round(grams);

  const serving = [
    servingGrams === null ? "" : `~${servingGrams} g`,
    servingGrams !== null && servingSize ? `(${servingSize})` : servingSize,
  ]
    .filter(Boolean)
    .join(" ");
  const rows: AssistantCard["rows"] = [];
  if (serving) {
    rows.push([i18n.t("nutrition:assistant.card.serving"), serving]);
  }
  if (date !== localDateStr()) {
    rows.push([i18n.t("nutrition:assistant.card.date"), date]);
  }
  rows.push(...nutrientRows(nutrition, settings.energyUnit));

  turn.addCard({
    kind: QUICK_CARD,
    title: name,
    rows,
    select: {
      label: i18n.t("nutrition:assistant.card.meal"),
      options: mealOptions(names),
      initial: String(meal),
    },
    actions: [
      {
        id: "add",
        text: i18n.t("nutrition:assistant.card.addToDiary"),
        isPrimary: true,
        run: async (selected) => {
          const slot = Number(selected);
          const kcal = Math.round(nutrition.calories || 0);
          await addToDiary(date, [
            quickCaloriesItem(
              {
                kcal,
                name,
                proteins: nutrition.proteins,
                carbohydrates: nutrition.carbohydrates,
                fat: nutrition.fat,
              },
              slot,
            ),
          ]);
          announceDiaryChange(date);
          return i18n.t("nutrition:assistant.card.logged", {
            energy: `${displayEnergy(kcal, settings.energyUnit)} ${settings.energyUnit}`,
            meal: mealLabel(names[slot] ?? ""),
          });
        },
      },
    ],
  });
  return {
    ok: true,
    kind: "quick_calories_proposal",
    name,
    meal,
    date,
    serving_grams: servingGrams,
    serving_size: servingSize,
    nutrition,
  };
}

async function proposeFood(args: Args, turn: TurnContext) {
  const nutrition = nutritionArg(args.nutrition);
  if (!nutrition) return { error: NO_CALORIES };
  const name = textArg(args.name, 60);
  if (!name)
    return { error: "name is required and must be a non-empty string." };
  const brand = textArg(args.brand, 60);
  const rawPortion = positiveArg(args.portion);
  const portion = rawPortion === null ? 100 : Math.round(rawPortion) || 100;
  const unit = textArg(args.unit, 16) || "g";
  const notes = textArg(args.notes, 120);
  const settings = await loadAssistantSettings();
  const names = mealNamesOf(settings);

  // Saved once, even when logging it fails and is tried again
  let saved: FoodRow | null = null;
  const save = async () => {
    saved ??= await foodsApi.create({
      name,
      brand: brand || null,
      portion,
      unit,
      nutrition,
      notes: notes || null,
      visibility: "private",
    });
    return saved;
  };

  turn.addCard({
    kind: FOOD_CARD,
    title: brand ? `${name} — ${brand}` : name,
    rows: [
      [i18n.t("nutrition:assistant.card.per"), amountAndUnit(portion, unit)],
      ...nutrientRows(nutrition, settings.energyUnit),
      ...(notes
        ? [
            [i18n.t("nutrition:assistant.card.notes"), notes] as [
              string,
              string,
            ],
          ]
        : []),
    ],
    select: {
      label: i18n.t("nutrition:assistant.card.logTo"),
      options: [
        { value: "", label: i18n.t("nutrition:assistant.card.dontLog") },
        ...mealOptions(names),
      ],
      initial: "",
    },
    actions: [
      {
        id: "save",
        text: i18n.t("nutrition:assistant.card.saveToFoods"),
        run: async () => {
          await save();
          return i18n.t("nutrition:assistant.card.saved", { name });
        },
      },
      {
        id: "saveAndLog",
        text: i18n.t("nutrition:assistant.card.saveAndLog"),
        isPrimary: true,
        isEnabled: (selected) => selected !== "",
        run: async (selected) => {
          // A meal nobody picked is never logged to
          if (selected === "") {
            throw new Error(i18n.t("nutrition:assistant.card.pickMeal"));
          }
          const slot = Number(selected);
          const food = loggableFood(await save());
          const date = localDateStr();
          await addToDiary(date, [
            newDiaryItem(diarySource(food, storedAmount(food)), slot),
          ]);
          announceDiaryChange(date);
          return i18n.t("nutrition:assistant.card.savedAndLogged", {
            name,
            meal: mealLabel(names[slot] ?? ""),
          });
        },
      },
    ],
  });
  return {
    ok: true,
    kind: "food_proposal",
    name,
    brand,
    portion,
    unit,
    nutrition,
    notes,
  };
}

export const proposalTools = {
  propose_quick_calories: proposeQuickCalories,
  propose_food: proposeFood,
};
