/**
 * Smart Log: what was said, parsed by the model, matched to records and saved
 * after a review. Ported from nutritrace/src/lib/quick-log.js and the logic
 * of components/diary/SmartLogModal.svelte.
 */
import { askAi, parseJsonReply, type AiSetup } from "@/features/shared/ai";

import {
  diaryApi,
  foodsApi,
  mealsApi,
  proxyGet,
  type DiaryItem,
  type FoodRow,
  type MealRow,
} from "../api";
import {
  announceDiaryChange,
  loadDiaryDay,
  markUsed,
  mutateDiaryDay,
} from "../diaryStore";
import { offOptions } from "../foods/sourceConfig";
import { parsePositive } from "../lib/decimal";
import { addDays, localDateStr } from "../lib/dates";
import {
  copiesOfItems,
  itemsOfMeal,
  newDiaryItem,
  newUuid,
} from "../lib/diary";
import { calculate, sumNutrition } from "../lib/nutrition";
import {
  diarySource,
  loggableFood,
  loggableRecipe,
  mealDiaryItems,
  storedAmount,
  type Loggable,
} from "../lib/pickItems";
import { foldText } from "../lib/searchText";
import { completeOffFood, searchOff } from "../lib/sources/openFoodFacts";
import { offNutritionStatus } from "../lib/sources/offStatus";
import { toFoodWrite, type ExternalFood } from "../lib/sources/types";
import type { NtSettings, WaterContainer } from "../settings";
import { DEFAULT_MEAL_NAMES } from "./settings";

export type ParsedKind = "food" | "meal" | "recipe" | "yesterday" | "water";

const KINDS: readonly ParsedKind[] = [
  "food",
  "meal",
  "recipe",
  "yesterday",
  "water",
];

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string | null;
  kind: ParsedKind;
}

export interface ParsedInput {
  /** One of the user's meal names, as the model read it */
  meal: string | null;
  items: ParsedItem[];
}

/** The model answered something other than the JSON asked for */
export class SmartLogParseError extends Error {
  constructor() {
    super("The AI parser returned invalid JSON.");
    this.name = "SmartLogParseError";
  }
}

// ── 1. Parsing ──────────────────────────────────────────────────────────

/** With the user's own meal slots and water containers, so those match */
export function buildParsePrompt(
  mealNames: string[],
  containers: WaterContainer[],
): string {
  const names = mealNames.length > 0 ? mealNames : DEFAULT_MEAL_NAMES;
  const namesQuoted = names.map((name) => `"${name}"`).join(", ");
  const containerHint =
    containers.length > 0
      ? `\nThe user's water containers are: ${containers.map((c) => `"${c.name}" (${c.volumeMl}ml)`).join(", ")}.`
      : "";

  return `You are a food and water parser for a nutrition tracking app. Extract food/water items AND the target meal from the user's input and return them as JSON.

The user's configured meal slots are: [${namesQuoted}]${containerHint}

Rules:
- Return ONLY valid JSON, no commentary, no markdown fences.
- Top-level shape: { "meal": <slot name from the list above, or null>, "items": [ ... ] }
- Each item has: name (string), quantity (number, default 1), unit (string or null), kind ("food" | "meal" | "recipe" | "yesterday" | "water").

ITEM KIND — figure out what the user is referring to:
- "food" (default): a single food, ingredient, or branded product. e.g. "2 eggs", "a slice of toast", "Greek yogurt"
- "meal": the user references a SAVED MEAL by name. Trigger phrases include "my X meal", "the meal called X", "my saved X", "X meal", "for breakfast I had my morning bowl meal".
- "recipe": the user references a SAVED RECIPE by name. Trigger phrases include "my X recipe", "the recipe X", "from my X recipe", "recipe called X".
- "yesterday": the user wants to repeat something from yesterday's diary. Trigger phrases include "same as yesterday", "yesterday's lunch", "what I had for breakfast yesterday", "repeat yesterday's dinner". For these items, set "name" to the meal slot from yesterday they want to repeat (e.g. "Lunch", "Breakfast"), quantity 1, unit null.
- "water": the user drank water or a beverage that counts as water intake. Trigger words: "water", "drank", "glass of water", "bottle of water", or a container name from the list above. Set "name" to the container name if one matches (e.g. "protein shaker"), otherwise set name to the unit word (e.g. "glass", "bottle"). Set "quantity" to the number of containers/glasses and "unit" to "ml", "oz", "L", or the container name.

Other rules:
- Use common units: "slice", "cup", "tbsp", "tsp", "oz", "g", "ml", "piece", "bowl", "can", "bottle".
- If no unit is specified for a countable item (eggs, bananas, apples), set unit to null.
- Words like "a", "an", "one" mean quantity 1. "couple" or "few" means 2. "some" means 1.
- Split compound items: "eggs and toast" → two items.
- The meal slot field at the top level is INDEPENDENT from the item kind. e.g. "for breakfast I had my chicken stir fry recipe" → meal="Breakfast", items=[{kind:"recipe", name:"chicken stir fry"}].
- For the meal field:
  * Match the user's input to one of their configured meal slots EXACTLY as written above (preserve case).
  * Use common sense: "this morning" / "for breakfast" → the breakfast-like slot. "tonight" / "for dinner" → the dinner-like slot. "as a snack" → the closest snack slot.
  * If the user has numbered slots (Snack 1/2/3) and doesn't specify, pick the FIRST.
  * If no meal is mentioned, set meal to null.
- Ignore filler words: "ate", "had", "I just had".

EXAMPLES:
Input: "for breakfast I had 2 eggs and toast"
Output: {"meal":"Breakfast","items":[{"name":"eggs","quantity":2,"unit":null,"kind":"food"},{"name":"toast","quantity":1,"unit":"slice","kind":"food"}]}

Input: "for lunch I had my chicken caesar salad meal"
Output: {"meal":"Lunch","items":[{"name":"chicken caesar salad","quantity":1,"unit":null,"kind":"meal"}]}

Input: "made my pasta carbonara recipe for dinner"
Output: {"meal":"Dinner","items":[{"name":"pasta carbonara","quantity":1,"unit":null,"kind":"recipe"}]}

Input: "same as yesterday for lunch"
Output: {"meal":"Lunch","items":[{"name":"Lunch","quantity":1,"unit":null,"kind":"yesterday"}]}

Input: "had my pre-workout meal and a banana"
Output: {"meal":null,"items":[{"name":"pre-workout","quantity":1,"unit":null,"kind":"meal"},{"name":"banana","quantity":1,"unit":null,"kind":"food"}]}

Input: "drank a glass of water"
Output: {"meal":null,"items":[{"name":"glass","quantity":1,"unit":"glass","kind":"water"}]}

Input: "500ml of water"
Output: {"meal":null,"items":[{"name":"water","quantity":500,"unit":"ml","kind":"water"}]}

Input: "had my protein shaker"
Output: {"meal":null,"items":[{"name":"protein shaker","quantity":1,"unit":"protein shaker","kind":"water"}]}`;
}

export function parseReply(reply: string): ParsedInput {
  const parsed = parseJsonReply(reply);
  if (!parsed) throw new SmartLogParseError();
  const raw: unknown[] = Array.isArray(parsed.items) ? parsed.items : [];
  const items = raw.flatMap((entry): ParsedItem[] => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) return [];
    const quantity = Number(item.quantity);
    return [
      {
        name,
        quantity: quantity > 0 ? quantity : 1,
        unit: typeof item.unit === "string" ? item.unit.trim() || null : null,
        kind: KINDS.find((kind) => kind === item.kind) ?? "food",
      },
    ];
  });
  const meal = typeof parsed.meal === "string" ? parsed.meal.trim() : "";
  return { meal: meal || null, items };
}

export async function parseInput(
  text: string,
  settings: NtSettings,
  setup: AiSetup,
  signal?: AbortSignal,
): Promise<ParsedInput> {
  if (!text.trim()) return { meal: null, items: [] };
  const reply = await askAi(
    setup.config,
    {
      systemPrompt: buildParsePrompt(
        settings.mealNames,
        settings.waterContainers,
      ),
      messages: [{ role: "user", content: text.trim() }],
      signal,
    },
    setup.shouldUseProxy,
  );
  return parseReply(reply);
}

const MEAL_ALIASES: Partial<Record<string, string[]>> = {
  breakfast: ["breakfast", "morning", "am", "wake", "first"],
  lunch: ["lunch", "noon", "midday"],
  dinner: ["dinner", "supper", "evening", "night"],
  snack: ["snack", "snacks"],
};

/**
 * The slot a meal name means: an exact name, else the shortest slot that
 * contains it or is contained, else by the usual words; null for none
 */
export function resolveMealSlot(
  mealName: string | null,
  mealNames: string[],
): number | null {
  const target = (mealName ?? "").toLowerCase().trim();
  if (!target) return null;
  const lower = mealNames.map((name) => name.toLowerCase());
  const exact = lower.indexOf(target);
  if (exact >= 0) return exact;
  const containing = lower
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name.includes(target) || target.includes(name))
    .sort((a, b) => a.name.length - b.name.length);
  if (containing.length > 0) return containing[0].index;
  const aliases = MEAL_ALIASES[target] ?? [];
  for (const test of ["startsWith", "includes"] as const) {
    const index = lower.findIndex((name) =>
      aliases.some((alias) => name[test](alias)),
    );
    if (index >= 0) return index;
  }
  return null;
}

// ── 2. Matching ─────────────────────────────────────────────────────────

export type Candidate =
  | { type: "food"; food: FoodRow }
  | { type: "off"; food: ExternalFood }
  | { type: "meal"; meal: MealRow }
  | { type: "recipe"; meal: MealRow }
  | { type: "yesterday"; slot: number; items: DiaryItem[] }
  | { type: "water"; amountMl: number; containerName: string | null };

export interface Match {
  item: ParsedItem;
  /** The first one is the suggestion; empty: not found */
  candidates: Candidate[];
}

const MAX_LOCAL = 8;
const MAX_OTHER = 5;

function tokensMatch(text: string, query: string): boolean {
  return query.split(/\s+/).every((token) => text.includes(token));
}

/** How often each food was logged, by id (or name) */
async function usageCounts(): Promise<Map<string | number, number>> {
  const counts = new Map<string | number, number>();
  const days = await diaryApi.all().catch(() => []);
  for (const day of days) {
    for (const item of day.items) {
      const key = item.id || item.name;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

async function localFoods(name: string): Promise<Candidate[]> {
  const query = foldText(name).trim();
  const foods = await foodsApi.list().catch((): FoodRow[] => []);
  const matches = foods.filter((food) =>
    query
      .split(/\s+/)
      .every(
        (token) =>
          foldText(food.name).includes(token) ||
          foldText(food.brand).includes(token),
      ),
  );
  if (matches.length === 0) return [];
  const counts = await usageCounts();
  const isExact = (food: FoodRow) => Number(foldText(food.name) === query);
  return matches
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        isExact(b) - isExact(a) ||
        a.name.length - b.name.length,
    )
    .slice(0, MAX_LOCAL)
    .map((food) => ({ type: "food", food }));
}

/**
 * Open Food Facts, the first hit with "as sold" values suggested (#241): one
 * without would be logged as 0 kcal
 */
async function offFoods(
  name: string,
  settings: NtSettings,
): Promise<Candidate[]> {
  const options = offOptions(settings);
  const hits = await searchOff(proxyGet, name, 1, options).then(
    (page) => page.items.slice(0, MAX_OTHER),
    (): ExternalFood[] => [],
  );
  if (hits.length === 0) return [];
  let best = hits.findIndex((hit) => offNutritionStatus(hit) === "ok");
  if (best < 0) {
    best = 0;
    // Search results leave values out: ask for the top one's full product
    hits[0] = (await completeOffFood(proxyGet, hits[0], options)).food;
  }
  const ordered = [hits[best], ...hits.filter((_, index) => index !== best)];
  return ordered.map((food) => ({ type: "off", food }));
}

async function savedMeals(
  name: string,
  type: "meal" | "recipe",
): Promise<Candidate[]> {
  const query = foldText(name).trim();
  if (!query) return [];
  const all = await (
    type === "recipe" ? mealsApi.recipes() : mealsApi.list()
  ).catch((): MealRow[] => []);
  const isExact = (meal: MealRow) => Number(foldText(meal.name) === query);
  return all
    .filter((meal) => tokensMatch(foldText(meal.name), query))
    .sort((a, b) => isExact(b) - isExact(a) || a.name.length - b.name.length)
    .slice(0, MAX_OTHER)
    .map((meal) => ({ type, meal }));
}

/** The entries of one of yesterday's meals; the item's name says which */
async function yesterdayMeal(
  name: string,
  settings: NtSettings,
  now: Date,
): Promise<Candidate[]> {
  const slot = resolveMealSlot(name, settings.mealNames);
  if (slot === null) return [];
  const day = await loadDiaryDay(addDays(localDateStr(now), -1)).catch(
    () => null,
  );
  const items = day ? itemsOfMeal(day.items, slot) : [];
  return items.length > 0 ? [{ type: "yesterday", slot, items }] : [];
}

/** What "a glass" or "a bottle" holds, in ml */
const WATER_DEFAULTS: Partial<Record<string, number>> = {
  glass: 240,
  cup: 240,
  mug: 350,
  bottle: 500,
  "water bottle": 500,
  "small bottle": 330,
  "large bottle": 750,
  jug: 1000,
  pitcher: 1000,
  sip: 30,
  gulp: 60,
  can: 355,
};

const ML_PER_UNIT: Partial<Record<string, number>> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  oz: 29.5735,
  "fl oz": 29.5735,
  "fluid ounce": 29.5735,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cl: 10,
  centiliter: 10,
};

/** The user's containers first, then a given amount, then a usual size */
export function waterAmount(
  item: ParsedItem,
  containers: WaterContainer[],
): { amountMl: number; containerName: string | null } {
  const name = foldText(item.name).trim();
  const unit = foldText(item.unit).trim();
  const quantity = item.quantity > 0 ? item.quantity : 1;
  const container =
    containers.find((entry) => {
      const own = foldText(entry.name);
      return own === name || own === unit;
    }) ??
    containers.find((entry) => {
      const own = foldText(entry.name);
      return name.includes(own) || own.includes(name);
    });
  if (container) {
    return {
      amountMl: Math.round((container.volumeMl || 250) * quantity),
      containerName: container.name,
    };
  }
  const size =
    ML_PER_UNIT[unit] ?? WATER_DEFAULTS[name] ?? WATER_DEFAULTS[unit] ?? 250;
  return { amountMl: Math.round(size * quantity), containerName: null };
}

export async function matchItem(
  item: ParsedItem,
  settings: NtSettings,
  now: Date = new Date(),
): Promise<Match> {
  let candidates: Candidate[];
  if (item.kind === "water") {
    candidates = [
      { type: "water", ...waterAmount(item, settings.waterContainers) },
    ];
  } else if (item.kind === "yesterday") {
    candidates = await yesterdayMeal(item.name, settings, now);
  } else if (item.kind === "meal" || item.kind === "recipe") {
    candidates = await savedMeals(item.name, item.kind);
  } else {
    candidates = await localFoods(item.name);
    if (candidates.length === 0) {
      candidates = await offFoods(item.name, settings);
    }
  }
  return { item, candidates };
}

export function matchItems(
  items: ParsedItem[],
  settings: NtSettings,
): Promise<Match[]> {
  return Promise.all(items.map((item) => matchItem(item, settings)));
}

// ── 3. Review ───────────────────────────────────────────────────────────

export interface ReviewRow extends Match {
  id: string;
  /** Index into `candidates` */
  picked: number;
  /** As typed: the portion in the food's unit, or the water in ml */
  amount: string;
  meal: number;
  isIncluded: boolean;
}

export function pickedOf(row: ReviewRow): Candidate | null {
  return row.candidates[row.picked] ?? null;
}

/** A food or recipe as it can be logged: it has a portion to choose */
export function portionedOf(
  candidate: Candidate | null,
): { portion: number; unit: string; nutrition: object } | null {
  if (
    candidate?.type !== "food" &&
    candidate?.type !== "off" &&
    candidate?.type !== "recipe"
  ) {
    return null;
  }
  const record = candidate.type === "recipe" ? candidate.meal : candidate.food;
  return {
    portion: record.portion > 0 ? record.portion : 100,
    unit: record.unit || "g",
    nutrition: record.nutrition,
  };
}

const MEASURES = new Set(["g", "ml", "gram", "grams"]);

/**
 * A weight or volume said is the portion itself; any other count is of the
 * record's portions
 */
export function defaultAmount(
  item: ParsedItem,
  candidate: Candidate | null,
): string {
  if (candidate?.type === "water") return String(candidate.amountMl);
  const portioned = portionedOf(candidate);
  if (!portioned) return "";
  const isMeasure = MEASURES.has((item.unit ?? "").toLowerCase().trim());
  const amount = isMeasure ? item.quantity : portioned.portion * item.quantity;
  return String(Math.round(amount * 100) / 100);
}

export function reviewRows(
  matches: Match[],
  meal: string | null,
  mealNames: string[],
  fallbackMeal = 0,
): ReviewRow[] {
  const slot = resolveMealSlot(meal, mealNames) ?? fallbackMeal;
  return matches.map((match, index) => ({
    ...match,
    id: String(index),
    picked: 0,
    amount: defaultAmount(match.item, match.candidates[0] ?? null),
    meal: slot,
    isIncluded: match.candidates.length > 0,
  }));
}

export function pickCandidate(row: ReviewRow, picked: number): ReviewRow {
  return {
    ...row,
    picked,
    amount: defaultAmount(row.item, row.candidates[picked] ?? null),
  };
}

/** Found, and not an Open Food Facts product without "as sold" values (#241) */
export function canLog(row: ReviewRow): boolean {
  const candidate = pickedOf(row);
  if (!candidate) return false;
  if (candidate.type === "off") {
    return offNutritionStatus(candidate.food) === "ok";
  }
  return true;
}

/** Will be written: included, loggable and with an amount where one counts */
export function isLogged(row: ReviewRow): boolean {
  if (!row.isIncluded || !canLog(row)) return false;
  const candidate = pickedOf(row);
  const hasAmount =
    candidate?.type === "water" || portionedOf(candidate) !== null;
  return !hasAmount || parsePositive(row.amount) !== null;
}

/** The calories of a row, for the review; null for water */
export function rowCalories(row: ReviewRow): number | null {
  const candidate = pickedOf(row);
  if (candidate?.type === "meal") {
    return sumNutrition(candidate.meal.items.map(calculate)).calories || 0;
  }
  if (candidate?.type === "yesterday") {
    return sumNutrition(candidate.items.map(calculate)).calories || 0;
  }
  const portioned = portionedOf(candidate);
  if (!portioned) return null;
  const kcal = Number((portioned.nutrition as { calories?: unknown }).calories);
  const amount = parsePositive(row.amount) ?? 0;
  return ((kcal || 0) * amount) / portioned.portion;
}

// ── 4. Saving ───────────────────────────────────────────────────────────

function portionItem(food: Loggable, row: ReviewRow): DiaryItem {
  const stored = storedAmount(food);
  return newDiaryItem(
    diarySource(food, {
      portion: parsePositive(row.amount) ?? stored.portion,
      unit: stored.unit,
      quantity: 1,
    }),
    row.meal,
  );
}

/** The diary entries of one row; an Open Food Facts pick is saved first */
async function rowItems(row: ReviewRow): Promise<DiaryItem[]> {
  const candidate = pickedOf(row);
  switch (candidate?.type) {
    case "food":
      return [portionItem(loggableFood(candidate.food), row)];
    case "recipe":
      // A recipe is one entry, unlike a meal
      return [portionItem(loggableRecipe(candidate.meal), row)];
    case "off": {
      const saved = await foodsApi.create(toFoodWrite(candidate.food));
      return [portionItem(loggableFood(saved), row)];
    }
    case "meal":
      return mealDiaryItems(candidate.meal, row.meal);
    case "yesterday":
      return copiesOfItems(candidate.items, row.meal);
    default:
      return [];
  }
}

/** Writes the included rows in one save; returns how many entries */
export async function saveRows(
  rows: ReviewRow[],
  date: string,
  formatTime: (time: Date) => string,
): Promise<number> {
  const wanted = rows.filter(isLogged);
  const items = (await Promise.all(wanted.map(rowItems))).flat();
  const water = wanted.flatMap((row) =>
    pickedOf(row)?.type === "water"
      ? [
          {
            uuid: newUuid(),
            amount: Math.round(parsePositive(row.amount) ?? 0),
            time: formatTime(new Date()),
          },
        ]
      : [],
  );
  const count = items.length + water.length;
  if (count === 0) return 0;
  await mutateDiaryDay(date, (day) => ({
    day: {
      ...day,
      items: [...day.items, ...items],
      water: [...day.water, ...water],
    },
  }));
  markUsed(items, date);
  announceDiaryChange(date);
  return count;
}
