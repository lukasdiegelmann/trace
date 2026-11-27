/**
 * `foodCategories` items are a plain string or `{ name, label }`, where the
 * label is an emoji (nutritrace/src/stores/settings.js, catName and co).
 */
export type FoodCategory = string | { name: string; label?: string };

export function categoryName(category: FoodCategory): string {
  return typeof category === "string" ? category : category.name;
}

export function categoryLabel(category: FoodCategory): string {
  return typeof category === "string" ? "" : (category.label ?? "");
}

export function categoryDisplay(category: FoodCategory): string {
  const label = categoryLabel(category);
  return label ? `${label} ${categoryName(category)}` : categoryName(category);
}

/** Adds a category; a name that exists already changes nothing */
export function addCategory(
  list: readonly FoodCategory[],
  name: string,
  label = "",
): FoodCategory[] {
  const trimmed = name.trim();
  if (!trimmed || list.some((item) => categoryName(item) === trimmed)) {
    return [...list];
  }
  const emoji = label.trim();
  return [...list, emoji ? { name: trimmed, label: emoji } : trimmed];
}

export function categoryList(value: unknown): FoodCategory[] {
  return Array.isArray(value) ? (value as FoodCategory[]) : [];
}
