/**
 * What changes a diary day, ported from nutritrace/src/stores/diary.js.
 * Every change is a pure function of the day as the server has it now,
 * addressing entries by `uuid`; `useDiaryDay` fetches, applies and saves.
 * The server merges by uuid: the newer `updatedAt || addedAt` wins and only
 * the uuids named in `deleted_uuids` are removed (server/lib/diary-merge.js).
 */
import type {
  BodyStats,
  DiaryDay,
  DiaryItem,
  DiaryWrite,
  MealItem,
  NutritionMap,
  WaterLog,
} from "../api";
import { calculate, round1, scaleNutrition, sumNutrition } from "./nutrition";
import { scaleFactor } from "./units";

export function newUuid(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Plain-http dev origins have no randomUUID; this is an id, not a secret
  const part = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${part()}${part()}-${part()}-${part()}-${part()}-${part()}${part()}${part()}`;
}

/**
 * What stays on a logged item (#125 upstream): the snapshot of what was eaten
 * and the keys the server hydrates from. Everything else of the source food
 * (ingredients, metadata) is dropped so a day stays small.
 */
const KEEP_FIELDS = [
  "uuid",
  "meal",
  "addedAt",
  "updatedAt",
  "type",
  "id",
  "food_server_id",
  "is_recipe",
  "food_device",
  "name",
  "brand",
  "portion",
  "unit",
  "quantity",
  "nutrition",
  "notes",
  "imgUrl",
  "source",
  "source_meal_id",
] as const;

/** `/nt/uploads/x` or a full URL back to the stored `/uploads/x`; data URLs out */
export function storedImageUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return "";
  const index = url.indexOf("/uploads/");
  if (index > 0 && (url.startsWith("http") || url.startsWith("/nt/"))) {
    return url.slice(index);
  }
  return url;
}

export function toReferenceShape(items: DiaryItem[]): DiaryItem[] {
  return items.map((item) => {
    const source = item as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of KEEP_FIELDS) if (key in source) out[key] = source[key];
    if (typeof out.imgUrl === "string") {
      out.imgUrl = storedImageUrl(out.imgUrl);
    }
    if (Array.isArray(item._splitItems)) {
      out._splitItems = toReferenceShape(item._splitItems);
    }
    return out as unknown as DiaryItem;
  });
}

export interface Deletions {
  items?: string[];
  water?: string[];
}

export function toDiaryWrite(
  day: DiaryDay,
  deleted: Deletions = {},
): DiaryWrite {
  return {
    items: toReferenceShape(day.items),
    body_stats: day.body_stats,
    water: day.water,
    notes: day.notes,
    deleted_uuids: {
      items: deleted.items ?? [],
      water: deleted.water ?? [],
    },
  };
}

/** The server's day with every list in place */
export function normalizeDay(day: Partial<DiaryDay>, date: string): DiaryDay {
  return {
    ...day,
    date: day.date ?? date,
    items: day.items ?? [],
    body_stats: day.body_stats ?? {},
    water: day.water ?? [],
    notes: day.notes ?? "",
    completed_at: day.completed_at ?? null,
    completed_meals: day.completed_meals ?? [],
  };
}

/** A changed day and what it removes; `null` means there is nothing to write */
export type DiaryChange = { day: DiaryDay; deleted?: Deletions } | null;

export type DiaryMutation = (day: DiaryDay) => DiaryChange;

export function mealIndexOf(item: DiaryItem): number {
  // Old rows may hold the slot as a string
  const meal: unknown = item.meal;
  return Number(meal) || 0;
}

export function itemsOfMeal(items: DiaryItem[], meal: number): DiaryItem[] {
  return items.filter((item) => mealIndexOf(item) === meal);
}

// ── Items ───────────────────────────────────────────────────────────────

/** What a new diary item is built from: a food, a meal or an ingredient */
export type DiaryItemSource = Omit<DiaryItem, "uuid" | "meal" | "addedAt">;

export function newDiaryItem(
  source: DiaryItemSource,
  meal: number,
  now: Date = new Date(),
): DiaryItem {
  const rest: Record<string, unknown> = { ...source };
  delete rest.uuid;
  delete rest.updatedAt;
  return {
    ...(rest as DiaryItemSource),
    uuid: newUuid(),
    meal,
    addedAt: now.toISOString(),
    food_server_id:
      source.food_server_id ??
      (typeof source.id === "number" ? source.id : null),
  };
}

export const appendItems =
  (items: DiaryItem[]): DiaryMutation =>
  (day) =>
    items.length === 0
      ? null
      : { day: { ...day, items: [...day.items, ...items] } };

export const removeItems =
  (uuids: string[]): DiaryMutation =>
  (day) => {
    const gone = new Set(uuids);
    return {
      day: { ...day, items: day.items.filter((item) => !gone.has(item.uuid)) },
      deleted: { items: uuids },
    };
  };

function mapItem(
  day: DiaryDay,
  uuid: string,
  change: (item: DiaryItem) => DiaryItem,
  now: Date,
): DiaryChange {
  if (!day.items.some((item) => item.uuid === uuid)) return null;
  return {
    day: {
      ...day,
      items: day.items.map((item) =>
        item.uuid === uuid
          ? { ...change(item), updatedAt: now.toISOString() }
          : item,
      ),
    },
  };
}

export const updateItem =
  (
    uuid: string,
    changes: Partial<DiaryItem>,
    now: Date = new Date(),
  ): DiaryMutation =>
  (day) =>
    mapItem(day, uuid, (item) => ({ ...item, ...changes }), now);

export const moveMealItems =
  (from: number, to: number, now: Date = new Date()): DiaryMutation =>
  (day) => {
    if (from === to || itemsOfMeal(day.items, from).length === 0) return null;
    return {
      day: {
        ...day,
        items: day.items.map((item) =>
          mealIndexOf(item) === from
            ? { ...item, meal: to, updatedAt: now.toISOString() }
            : item,
        ),
      },
    };
  };

export const clearMealItems =
  (meal: number): DiaryMutation =>
  (day) => {
    const uuids = itemsOfMeal(day.items, meal).map((item) => item.uuid);
    return uuids.length === 0 ? null : removeItems(uuids)(day);
  };

/** Copies for another day or meal: new identity, logged now */
export function copiesOfItems(
  items: DiaryItem[],
  meal: number,
  now: Date = new Date(),
): DiaryItem[] {
  return items.map((item) => {
    const copy = newDiaryItem(item, meal, now);
    if (item._splitItems) {
      copy._splitItems = item._splitItems.map((child) => ({
        ...child,
        uuid: newUuid(),
        meal,
      }));
    }
    return copy;
  });
}

// ── Quick calories ──────────────────────────────────────────────────────

export const QUICK_CALORIES_NAME = "Quick Calories";

export interface QuickCaloriesInput {
  kcal: number;
  name?: string;
  proteins?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
}

const MACRO_KEYS = ["proteins", "carbohydrates", "fat"] as const;

/** Calories and the macros given (> 0, one decimal); throws without calories */
export function quickCaloriesValues(input: QuickCaloriesInput): {
  name: string;
  nutrition: NutritionMap;
} {
  const calories = Math.max(0, Math.round(input.kcal || 0));
  if (!calories) {
    throw new Error("Quick Calories requires a positive kcal value.");
  }
  const nutrition: NutritionMap = { calories };
  for (const key of MACRO_KEYS) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value > 0) nutrition[key] = round1(value);
  }
  const name = input.name?.trim().slice(0, 60) || QUICK_CALORIES_NAME;
  return { name, nutrition };
}

export function quickCaloriesItem(
  input: QuickCaloriesInput,
  meal: number,
  now: Date = new Date(),
): DiaryItem {
  return newDiaryItem(
    { type: "quick_calories", ...quickCaloriesValues(input) },
    meal,
    now,
  );
}

// ── Split recipes ───────────────────────────────────────────────────────

/**
 * A logged recipe's ingredients, scaled to the amount logged: portion in
 * grams (one decimal, at least 0.1), one serving, nutrition for that portion.
 * The recipe's mass is the sum of its ingredients (its own portion may have
 * been edited by hand).
 */
export function splitIngredients(
  item: DiaryItem,
  ingredients: MealItem[],
  recipe: { portion?: number; quantity?: number } = {},
  now: Date = new Date(),
): DiaryItem[] {
  const itemMass = (item.portion || 100) * (item.quantity || 1);
  let ingredientsMass = 0;
  for (const ingredient of ingredients) {
    const portion = parseFloat(String(ingredient.portion));
    const quantity = parseFloat(String(ingredient.quantity));
    if (!Number.isFinite(portion) || portion <= 0) continue;
    ingredientsMass +=
      portion * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }
  const recipeMass =
    ingredientsMass > 0
      ? ingredientsMass
      : (recipe.portion || 100) * (recipe.quantity || 1);
  const scale = recipeMass > 0 ? itemMass / recipeMass : 1;

  return ingredients.map((ingredient) => {
    const portion = parseFloat(String(ingredient.portion)) || 100;
    const quantity = parseFloat(String(ingredient.quantity)) || 1;
    const newPortion = Math.max(0.1, round1(portion * quantity * scale));
    const factor = newPortion / (portion * quantity);
    const nutrition: NutritionMap = {};
    for (const [key, value] of Object.entries(ingredient.nutrition)) {
      if (key === "_derived") continue;
      nutrition[key] = (parseFloat(String(value)) || 0) * factor;
    }
    return {
      ...(ingredient as unknown as DiaryItem),
      uuid: newUuid(),
      meal: mealIndexOf(item),
      portion: newPortion,
      quantity: 1,
      nutrition,
      addedAt: now.toISOString(),
      food_server_id: typeof ingredient.id === "number" ? ingredient.id : null,
    };
  });
}

export function isSplit(item: DiaryItem): boolean {
  return Array.isArray(item._splitItems) && item._splitItems.length > 0;
}

/** Removing the last ingredient removes the whole recipe */
export const removeSplitChild =
  (uuid: string, childIndex: number, now: Date = new Date()): DiaryMutation =>
  (day) => {
    const parent = day.items.find((item) => item.uuid === uuid);
    if (!parent?._splitItems?.[childIndex]) return null;
    const remaining = parent._splitItems.filter(
      (_, index) => index !== childIndex,
    );
    if (remaining.length === 0) return removeItems([uuid])(day);
    return mapItem(
      day,
      uuid,
      (item) => ({ ...item, _splitItems: remaining }),
      now,
    );
  };

export const updateSplitChild =
  (
    uuid: string,
    childIndex: number,
    changes: Partial<DiaryItem>,
    now: Date = new Date(),
  ): DiaryMutation =>
  (day) => {
    const parent = day.items.find((item) => item.uuid === uuid);
    if (!parent?._splitItems?.[childIndex]) return null;
    return mapItem(
      day,
      uuid,
      (item) => ({
        ...item,
        _splitItems: (item._splitItems ?? []).map((child, index) =>
          index === childIndex ? { ...child, ...changes } : child,
        ),
      }),
      now,
    );
  };

// ── Water, body stats, notes ────────────────────────────────────────────

export const addWater =
  (log: WaterLog): DiaryMutation =>
  (day) => ({ day: { ...day, water: [...day.water, log] } });

export const updateWater =
  (uuid: string, amount: number, now: Date = new Date()): DiaryMutation =>
  (day) => {
    if (!day.water.some((entry) => entry.uuid === uuid)) return null;
    return {
      day: {
        ...day,
        water: day.water.map((entry) =>
          entry.uuid === uuid
            ? { ...entry, amount, updatedAt: now.toISOString() }
            : entry,
        ),
      },
    };
  };

export const removeWater =
  (uuid: string): DiaryMutation =>
  (day) => ({
    day: { ...day, water: day.water.filter((entry) => entry.uuid !== uuid) },
    deleted: { water: [uuid] },
  });

export function waterTotal(water: WaterLog[]): number {
  return water.reduce((sum, entry) => sum + (entry.amount || 0), 0);
}

export const mergeBodyStats =
  (stats: BodyStats): DiaryMutation =>
  (day) => ({
    day: { ...day, body_stats: { ...day.body_stats, ...stats } },
  });

export const setNote =
  (text: string): DiaryMutation =>
  (day) => {
    const notes = text.replace(/\s+$/, "");
    return notes === day.notes ? null : { day: { ...day, notes } };
  };

// ── Totals ──────────────────────────────────────────────────────────────

export function dayTotals(items: DiaryItem[]) {
  return sumNutrition(items.map(calculate));
}

export interface MealShare {
  kcal: number;
  /** Share of the meal's calories, 4/4/9 */
  protein: number;
  carbs: number;
  fat: number;
}

/** A meal's calories and macro shares (Diary's getMealTotals); null without calories */
export function mealShare(items: DiaryItem[]): MealShare | null {
  const totals = dayTotals(items);
  const kcal = totals.calories || 0;
  if (!(kcal > 0)) return null;
  const share = (grams: number, density: number) =>
    Math.round(((grams * density) / kcal) * 100);
  return {
    kcal: Math.round(kcal),
    protein: share(totals.proteins || 0, 4),
    carbs: share(totals.carbohydrates || 0, 4),
    fat: share(totals.fat || 0, 9),
  };
}

export interface Contributor {
  item: DiaryItem;
  value: number;
}

/** Where a nutrient came from, largest first */
export function contributors(items: DiaryItem[], id: string): Contributor[] {
  return items
    .map((item) => ({ item, value: calculate(item)[id] || 0 }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ── Editing an entry ────────────────────────────────────────────────────

export interface PortionEdit {
  portion: number;
  unit: string;
  quantity: number;
}

/**
 * An entry at a new portion and unit: its nutrition (stored for the portion)
 * scales along; the servings only change what counts.
 */
export function portionChanges(
  item: DiaryItem,
  edit: PortionEdit,
): Pick<DiaryItem, "portion" | "unit" | "quantity" | "nutrition"> {
  const factor = scaleFactor(
    item.portion,
    item.unit || "g",
    edit.portion,
    edit.unit,
    item,
  );
  return {
    portion: edit.portion,
    unit: edit.unit,
    quantity: edit.quantity,
    nutrition: scaleNutrition(item.nutrition, factor),
  };
}

/** `HH:MM` of an ISO time on the local clock; empty if unreadable */
export function timeOfDay(iso: string | undefined): string {
  const date = new Date(iso ?? "");
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The same local day at another time of day; unchanged if either is unreadable */
export function withTimeOfDay(iso: string, time: string): string {
  const date = new Date(iso);
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match || Number.isNaN(date.getTime())) return iso;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.toISOString();
}
