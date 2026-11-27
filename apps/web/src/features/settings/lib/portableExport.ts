/**
 * NutriTrace's portable JSON file (SettingsImportExport.svelte): the same
 * shape the old UI writes and reads, so files move between the two.
 */
import {
  categoryList,
  categoryName,
  type FoodCategory,
} from "./foodCategories";

type Row = Record<string, unknown>;

/** The server's `img_url`/`category` as the file's `imgUrl`/`categories` */
export function toFileFood(food: Row): Row {
  const { img_url: image, category, ...rest } = food;
  return {
    ...rest,
    imgUrl: image ?? "",
    categories: category ? [category] : [],
  };
}

export function toFileMeal(meal: Row): Row {
  const { img_url: image, ...rest } = meal;
  return { ...rest, imgUrl: image ?? "" };
}

export interface PortableData {
  foodList: Row[];
  meals: Row[];
  recipes: Row[];
  diary: Row[];
  activity: Row[];
  fasts: Row[];
  settings: Row;
}

export function portableExport(
  data: PortableData,
  version: string,
  now: Date = new Date(),
): PortableData & { _manifest: Row; exportedAt: string } {
  const exportedAt = now.toISOString();
  return {
    _manifest: {
      format: "nutritrace-portable-export",
      schema_version: 1,
      app_version: version,
      exported_at: exportedAt,
      source: "web",
      includes_images: false,
      scope:
        "foods, meals, recipes, diary (with notes), activity, fasts, settings. Excluded by design: wellness metrics and computed scores, workouts, AI chat history, sharing grants, federation API tokens and OAuth wearable tokens.",
      counts: {
        foods: data.foodList.length,
        meals: data.meals.length,
        recipes: data.recipes.length,
        diary: data.diary.length,
        activity: data.activity.length,
        fasts: data.fasts.length,
        settings: Object.keys(data.settings).length,
      },
    },
    ...data,
    exportedAt,
  };
}

/** The categories of imported foods that the user's list doesn't have */
export function withImportedCategories(
  existing: unknown,
  foods: readonly Row[],
): FoodCategory[] | null {
  const list = categoryList(existing);
  const known = new Set(list.map(categoryName));
  const added = new Set<string>();
  for (const food of foods) {
    const first = Array.isArray(food.categories)
      ? (food.categories as unknown[])[0]
      : undefined;
    const name = first || food.category;
    if (typeof name === "string" && name && !known.has(name)) added.add(name);
  }
  return added.size ? [...list, ...added] : null;
}
