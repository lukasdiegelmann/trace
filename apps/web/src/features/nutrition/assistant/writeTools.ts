/**
 * The tools that write without a review: activity, a named food and Quick
 * Calories, with Trace.svelte's gates
 */

import {
  activityApi,
  foodsApi,
  proxyGet,
  type ActivitySource,
  type FoodRow,
} from "../api";
import { addToDiary, announceDiaryChange } from "../diaryStore";
import { offOptions } from "../foods/sourceConfig";
import { newDiaryItem, quickCaloriesItem } from "../lib/diary";
import { diarySource, loggableFood, storedAmount } from "../lib/pickItems";
import { completeOffFood, searchOff } from "../lib/sources/openFoodFacts";
import { toFoodWrite, type ExternalFood } from "../lib/sources/types";
import { parseAltUnits, unitToGrams } from "../lib/units";
import {
  dateArg,
  errorText,
  mealSlotArg,
  positiveArg,
  textArg,
  wholeArg,
  type Args,
} from "./args";
import {
  loadAssistantSettings,
  mealNamesOf,
  type AssistantSettings,
} from "./settings";

const AI_SOURCES: readonly ActivitySource[] = [
  "ai_estimated",
  "user_stated",
  "compendium",
  "manual_form",
];

function estimateRefusal(settings: AssistantSettings): string {
  if (!settings.activityAutoEstimate) {
    return "Auto-estimation is off. Ask the user for a calorie number, or have them enable Settings → AI Assistant → Estimate activity calories.";
  }
  const hasProfile =
    Number(settings.weight_kg) &&
    Number(settings.height_cm) &&
    settings.dob &&
    settings.gender;
  if (!hasProfile) {
    return "Cannot estimate — missing body profile fields. Ask the user to fill in weight, height, date of birth, and sex on their profile, or supply a calorie number directly.";
  }
  // The model computes the estimate; a zero is never logged
  return "Estimation needs a non-zero kcal value. Compute kcal from duration + MET × body weight and call again with kcal set.";
}

async function addActivityEntry(args: Args) {
  const settings = await loadAssistantSettings();
  if (!settings.diaryShowActivity) {
    return {
      error:
        "Activity logging is disabled. The user must turn on Settings → Diary → Show activity section before you can log activity.",
    };
  }
  const name = textArg(args.name);
  if (!name) return { error: "Activity name required." };
  const kcal = wholeArg(args.kcal);
  const source =
    AI_SOURCES.find((known) => known === args.source) ?? "manual_form";
  const met =
    args.met != null && Number.isFinite(Number(args.met))
      ? Math.max(0, Math.min(25, Number(args.met)))
      : null;
  const isTemplate = Boolean(args.is_template);
  if (!kcal && source === "ai_estimated") {
    return { error: estimateRefusal(settings) };
  }
  if (!kcal) return { error: "kcal must be a positive integer." };
  const date = dateArg(args.date);
  try {
    await activityApi.create({
      date,
      name,
      kcal,
      duration_min:
        args.duration_min != null ? wholeArg(args.duration_min) : null,
      distance: textArg(args.distance, 40) || null,
      source,
      met,
      is_template: isTemplate,
    });
  } catch (caught) {
    return { error: "Failed to save activity: " + errorText(caught) };
  }
  announceDiaryChange(date);
  return {
    ok: true,
    date,
    name,
    kcal,
    source,
    met,
    is_template: isTemplate,
  };
}

// ── log_food ────────────────────────────────────────────────────────────

interface FoodLog {
  slot: number;
  mealName: string;
  date: string;
  quantity: number;
  portion: number | null;
  unit: string | null;
}

/** Grams one of `unit` weighs, by the food's own units or the mass table */
function gramsOf(food: FoodRow, unit: string): number | null {
  const own = parseAltUnits(food.alt_units)?.find(
    (row) => row.abbr.toLowerCase() === unit.toLowerCase(),
  );
  return own?.grams ?? unitToGrams(unit);
}

async function logRow(food: FoodRow, log: FoodLog, source: "local" | "off") {
  const loggable = loggableFood(food);
  const stored = storedAmount(loggable);
  // A unit says what the portion counts; alone it would only relabel it
  const unit = (log.portion !== null && log.unit) || stored.unit;
  const isSameUnit = unit.toLowerCase() === stored.unit.toLowerCase();
  if (
    !isSameUnit &&
    (gramsOf(food, unit) === null || gramsOf(food, stored.unit) === null)
  ) {
    return {
      error: `Can't convert "${unit}" to "${stored.unit}" for ${food.name}, so nothing was logged. Give the amount in ${stored.unit}, or use quantity for a number of servings of ${stored.portion} ${stored.unit}.`,
    };
  }
  const entry = diarySource(loggable, {
    portion: log.portion ?? stored.portion,
    unit,
    quantity: log.quantity,
  });
  try {
    await addToDiary(log.date, [newDiaryItem(entry, log.slot)]);
  } catch (caught) {
    return { error: "Failed to log food: " + errorText(caught) };
  }
  announceDiaryChange(log.date);
  return {
    ok: true,
    date: log.date,
    meal: log.slot,
    meal_name: log.mealName,
    food_name: food.name,
    portion: entry.portion,
    unit: entry.unit,
    quantity: log.quantity,
    kcal: Math.round((entry.nutrition.calories || 0) * log.quantity),
    source,
  };
}

const MAX_CANDIDATES = 5;

function candidates(
  foods: (FoodRow | ExternalFood)[],
  source: "local" | "off",
) {
  return foods.slice(0, MAX_CANDIDATES).map((food) => ({
    name: food.name,
    brand: food.brand || "",
    portion: food.portion || 100,
    unit: food.unit || "g",
    source,
  }));
}

function matchKey(name: string): string {
  return name.toLowerCase().trim();
}

/** An Open Food Facts hit: saved as a food, then logged */
async function logOffHit(
  hit: ExternalFood,
  log: FoodLog,
  settings: AssistantSettings,
) {
  // Search results leave values out: the full product decides (#241)
  const { food, status } = await completeOffFood(
    proxyGet,
    hit,
    offOptions(settings),
  );
  if (status !== "ok") {
    const isPreparedOnly = status !== "none";
    return {
      no_nutrition: true,
      food_name: food.name,
      as_prepared_only: isPreparedOnly,
      message:
        `Open Food Facts has no "as sold" nutrition values for "${food.name}"` +
        (isPreparedOnly
          ? ', only "as prepared" ones (for example made up with milk or water), which may not match what the user weighs.'
          : ".") +
        " Nothing was logged. Tell the user, and suggest adding it under Foods, where they can enter the values from the label" +
        (isPreparedOnly ? ' or choose to use the "as prepared" ones.' : "."),
    };
  }
  let saved: FoodRow;
  try {
    saved = await foodsApi.create(toFoodWrite(food));
  } catch (caught) {
    return {
      error: "Failed to log food after OFF lookup: " + errorText(caught),
    };
  }
  return logRow(saved, log, "off");
}

async function logFood(args: Args) {
  const query = textArg(args.food);
  if (!query) return { error: "food name is required." };
  if (args.meal == null) {
    return {
      error:
        "meal index is required. Match the user's named meal to the YOUR MEALS list in the system prompt.",
    };
  }
  if (!Number.isFinite(Number(args.meal))) {
    return { error: "meal must be a numeric index." };
  }
  const settings = await loadAssistantSettings();
  const names = mealNamesOf(settings);
  const slot = mealSlotArg(args.meal, names.length);
  const log: FoodLog = {
    slot,
    mealName: names[slot] || `Meal ${slot + 1}`,
    date: dateArg(args.date),
    quantity: positiveArg(args.quantity) ?? 1,
    portion: positiveArg(args.portion),
    unit: textArg(args.unit) || null,
  };
  const wanted = matchKey(query);

  // 1. The user's own foods: an exact name, else a single partial match
  const foods = await foodsApi.list().catch((): FoodRow[] => []);
  const exact = foods.filter((food) => matchKey(food.name) === wanted);
  if (exact.length === 1) return logRow(exact[0], log, "local");
  if (exact.length > 1) {
    return {
      candidates: candidates(exact, "local"),
      hint: `${exact.length} local foods match "${query}" exactly. Ask the user which one (by brand or saved portion).`,
    };
  }
  const partial = foods.filter((food) => matchKey(food.name).includes(wanted));
  if (partial.length === 1) return logRow(partial[0], log, "local");
  if (partial.length > 1) {
    return {
      candidates: candidates(partial, "local"),
      hint: `Found ${partial.length} local food(s) containing "${query}"${partial.length > MAX_CANDIDATES ? " (showing top 5)" : ""}. Ask the user which one (or none) before calling log_food again with the chosen name.`,
    };
  }

  // 2. Open Food Facts (or the server's local mirror of it)
  const hits = await searchOff(proxyGet, query, 1, offOptions(settings)).then(
    (page) => page.items,
    (): ExternalFood[] => [],
  );
  if (hits.length > 0) {
    const picked =
      hits.find((hit) => matchKey(hit.name) === wanted) ??
      (hits.length === 1 ? hits[0] : null);
    if (picked) return logOffHit(picked, log, settings);
    return {
      candidates: candidates(hits, "off"),
      hint: `Found ${hits.length} Open Food Facts matches for "${query}". None is an exact name match — ask the user which one fits, then call log_food again with that exact name.`,
    };
  }

  // 3. Nothing
  return {
    no_match: true,
    suggestion: `No local food and no Open Food Facts match for "${query}". The user should add it via the Foods tab — either scan a barcode or tap "+" to enter it manually — then ask again.`,
  };
}

// ── log_quick_calories ──────────────────────────────────────────────────

async function logQuickCalories(args: Args) {
  const settings = await loadAssistantSettings();
  if (!settings.showQuickCalories) {
    return {
      error:
        "Quick Calories logging is disabled. The user must turn on Settings → Diary → Show Quick Calories Button before you can log a quick entry.",
    };
  }
  const kcal = wholeArg(args.kcal);
  if (!kcal) return { error: "kcal must be a positive integer." };
  const slot = mealSlotArg(args.meal, mealNamesOf(settings).length);
  const name = textArg(args.name, 60);
  const date = dateArg(args.date);
  // Only macros the user gave; blank stays blank in the entry
  const proteins = positiveArg(args.protein_g);
  const carbohydrates = positiveArg(args.carbs_g);
  const fat = positiveArg(args.fat_g);
  try {
    await addToDiary(date, [
      quickCaloriesItem({ kcal, name, proteins, carbohydrates, fat }, slot),
    ]);
  } catch (caught) {
    return { error: "Failed to log quick calories: " + errorText(caught) };
  }
  announceDiaryChange(date);
  return {
    ok: true,
    date,
    meal: slot,
    kcal,
    name: name || "Quick Calories",
    protein_g: proteins,
    carbs_g: carbohydrates,
    fat_g: fat,
  };
}

export const writeTools = {
  add_activity_entry: addActivityEntry,
  log_food: logFood,
  log_quick_calories: logQuickCalories,
};
